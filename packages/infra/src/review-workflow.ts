import { randomUUID, createHash } from 'node:crypto';
import { ProductionSchema, DossierSchema, AssetSchema, EvaluationSchema, ApprovalSchema, ReviewPointSchema,
  ReviewViewSchema, DeliveryViewSchema, CreateReviewPointSchema, ResolveReviewPointSchema, ApproveReviewSchema,
  ExportDeliverySchema, ExportManifestSchema, ProposeCorrectionSchema, CancelCorrectionSchema, CorrectionSchema, RenderHistorySchema, EditSpeechSchema, SpeechEditViewSchema,ProductionSnapshotSchema,
  CorrectionExecutionPlanSchema,AuthorizeCorrectionSchema,ExecuteCorrectionSchema,PublishCorrectionAssetsSchema,GenerationExecutionSchema,ApprovePlanningSchema,type Correction,type AssetStore, type Production, type Dossier, type Asset,
  type ReviewPoint, type VersionRef, type ProductionEvent,type GenerationAdmission } from '@fbr/contracts';
import { ApplicationError, canonical, sha256, sameRef, buildDeliveryManifest, correctionImpact, invalidateDossier,inspectDossier,budgetPreflight } from '@fbr/domain';
import type { SqlClient, SqlDatabase } from './configuration-store.js';
import { storeDeliveryManifest } from './delivery-store.js';
import {PostgresMediaStore,type MediaWrite} from './media-store.js';
import {PostgresGenerationQueue} from './generation-queue.js';
import {belongsToExecution} from './asset-provenance.js';
import {audioSpecificationMatches} from '@fbr/pipeline';
import type {SourceReauditor} from './source-reaudit.js';

const mediaSchemas = { asset: AssetSchema, evaluation: EvaluationSchema, approval: ApprovalSchema };
async function production(client: SqlClient, id: string, lock = false) {
  const head = (await client.query(`SELECT version FROM production_heads WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
  if (!head) throw new ApplicationError('not_found','Produção não encontrada.');
  return ProductionSchema.parse((await client.query('SELECT record FROM production_revisions WHERE id=$1 AND version=$2', [id,head.version])).rows[0]?.record);
}
async function dossier(client: SqlClient, p: Production): Promise<Dossier | null> {
  if (!p.dossier) return null;
  const row = (await client.query('SELECT record FROM production_dossiers WHERE id=$1 AND version=$2',[p.dossier.id,p.dossier.version])).rows[0];
  if (!row) throw new ApplicationError('ineligible','Dossiê da revisão não está disponível.');
  const d = DossierSchema.parse(row.record);
  if (d.production.id !== p.id) throw new ApplicationError('ineligible','Dossiê pertence a outra produção.');
  return d;
}
async function points(client: SqlClient, id: string) {
  const result = await client.query('SELECT r.record FROM review_point_revisions r JOIN review_point_heads h USING(id,version) WHERE h.production_id=$1 ORDER BY h.id',[id]);
  return result.rows.map(row=>ReviewPointSchema.parse(row.record));
}
async function unfinishedExecutions(client:SqlClient,id:string){
  return !!(await client.query("SELECT 1 FROM generation_revisions r JOIN generation_heads h USING(id,version) WHERE h.production_id=$1 AND r.record->>'state' NOT IN ('succeeded','failed','cancelled') LIMIT 1",[id])).rows.length;
}
async function appendProduction(client: SqlClient, p: Production, patch: Partial<Production>, type: ProductionEvent['type'], message: string) {
  const at = new Date().toISOString(), next = ProductionSchema.parse({...p,...patch,version:p.version+1,created_at:at,
    changes:[...p.changes,{at,author:'local_operator',reason:message}]});
  const changed = await client.query('UPDATE production_heads SET version=$2 WHERE id=$1 AND version=$3 RETURNING id',[p.id,next.version,p.version]);
  if (changed.rowCount!==1) throw new ApplicationError('conflict','Produção alterada por outra operação.');
  await client.query('INSERT INTO production_revisions(id,version,record) VALUES($1,$2,$3::jsonb)',[p.id,next.version,JSON.stringify(next)]);
  const eventId=randomUUID();
  await client.query('INSERT INTO production_events(id,production_id,version,record) VALUES($1,$2,$3,$4::jsonb)',
    [eventId,p.id,next.version,JSON.stringify({id:eventId,production:{id:p.id,version:next.version},at,type,message})]);
  return next;
}
async function saveMedia(client: SqlClient, productionId: string, kind: keyof typeof mediaSchemas, raw: unknown, expected: number|null) {
  const record=mediaSchemas[kind].parse(raw);
  if(expected===null) await client.query('INSERT INTO media_heads(kind,id,production_id,version) VALUES($1,$2,$3,0) ON CONFLICT DO NOTHING',[kind,record.id,productionId]);
  const changed=await client.query('UPDATE media_heads SET version=$3 WHERE kind=$1 AND id=$2 AND version=$4 AND production_id=$5 RETURNING id',[kind,record.id,record.version,expected??0,productionId]);
  if(changed.rowCount!==1) throw new ApplicationError('conflict','Revisão de mídia desatualizada.');
  await client.query('INSERT INTO media_revisions(kind,id,version,record) VALUES($1,$2,$3,$4::jsonb)',[kind,record.id,record.version,JSON.stringify(record)]);
}
const mediaUrl=(id:string,ref:VersionRef)=>`/api/productions/${encodeURIComponent(id)}/assets/${encodeURIComponent(ref.id)}?version=${ref.version}`;
const subtitleRefs=(d:Dossier)=>d.assets.filter(asset=>asset.type==='subtitle'&&!!d.timeline&&sameRef(asset.specification,d.timeline)
  &&!['outdated','rejected'].includes(asset.status)).map(asset=>({id:asset.id,version:asset.version}));

export class PostgresReviewWorkflow {
  constructor(private readonly db: SqlDatabase, private readonly files: AssetStore,private readonly admission?:GenerationAdmission,private readonly sourceReauditor?:SourceReauditor) {}
  private async render(client: SqlClient,p: Production,d: Dossier|null, ref=p.current_render): Promise<Asset|null> {
    if(!ref||!d?.timeline) return null;
    const row=(await client.query(`SELECT r.record FROM media_revisions r JOIN media_heads h USING(kind,id)
      WHERE r.kind='asset' AND r.id=$1 AND r.version=$2 AND h.production_id=$3 AND h.version=r.version`,[ref.id,ref.version,p.id])).rows[0];
    if(!row) return null;
    const asset=AssetSchema.parse(row.record);
    const included=d.assets.find(value=>sameRef(value,asset));
    if(asset.type!=='render'||asset.file.mime_type!=='video/mp4'||!included||canonical(included)!==canonical(asset)||['outdated','rejected'].includes(asset.status)
      ||d.timeline.status!=='rendered'||d.timeline.production.id!==p.id||!sameRef(asset.specification,d.timeline)
      ||!asset.file.duration_seconds||!await this.files.exists(asset)) return null;
    return asset;
  }
  private scenes(d: Dossier) {
    return d.timeline!.video.map(segment=>{
      const shot=d.shots.find(shot=>sameRef(shot,segment.shot));
      if(!shot) throw new ApplicationError('ineligible','Cena da timeline não corresponde ao dossiê.');
      const speeches=d.blocks.flatMap(block=>block.speeches);
      return {ref:{id:shot.id,version:shot.version},title:shot.intent,start_seconds:segment.start_seconds,end_seconds:segment.end_seconds,
        transcript:shot.speech_segment_ids.map(id=>speeches.find(s=>s.id===id)?.text??'').join(' ')};
    });
  }
  private async historicalRender(id:string,version:number){
    const row=(await this.db.query('SELECT record FROM production_revisions WHERE id=$1 AND version=$2',[id,version])).rows[0];
    if(!row)return null;
    const p=ProductionSchema.parse(row.record),d=await dossier(this.db,p);
    if(!p.current_render||!d?.timeline||d.timeline.status!=='rendered')return null;
    const owned=(await this.db.query("SELECT r.record FROM media_revisions r JOIN media_heads h USING(kind,id) WHERE r.kind='asset' AND r.id=$1 AND r.version=$2 AND h.production_id=$3",[p.current_render.id,p.current_render.version,id])).rows[0];
    if(!owned)return null;
    const asset=AssetSchema.parse(owned.record),included=d.assets.find(a=>sameRef(a,asset));
    if(!included||canonical(included)!==canonical(asset)||asset.type!=='render'||asset.file.mime_type!=='video/mp4'
      ||!sameRef(asset.specification,d.timeline)||d.timeline.production.id!==id)return null;
    return {p,d,asset};
  }
  async history(id:string){
    const current=await production(this.db,id);
    const rows=(await this.db.query('SELECT version FROM production_revisions WHERE id=$1 ORDER BY version DESC LIMIT 100',[id])).rows;
    const items=[],seen=new Set<string>();
    for(const row of rows){
      const historic=await this.historicalRender(id,Number(row.version));if(!historic)continue;
      const {p,d,asset}=historic,key=`${asset.id}:${asset.version}`;if(seen.has(key))continue;seen.add(key);
      items.push({production:{id,version:p.version},dossier:{id:d.id,version:d.version},render:{id:asset.id,version:asset.version},
        hash:asset.file.hash,created_at:asset.created_at,current:!!current.current_render&&sameRef(current.current_render,asset),
        available:await this.files.exists(asset),preview_url:`/api/productions/${encodeURIComponent(id)}/review/history/${p.version}/video`,scenes:this.scenes(d)});
    }
    return RenderHistorySchema.parse({items});
  }
  async historicalAsset(id:string,version:number){
    await production(this.db,id);
    const historic=await this.historicalRender(id,version);
    if(!historic||historic.asset.file.bytes>100_000_000)throw new ApplicationError('not_found','Vídeo histórico não disponível.');
    const bytes=await this.files.read(historic.asset.file.storage_key);
    if(bytes.length!==historic.asset.file.bytes||sha256Bytes(bytes)!==historic.asset.file.hash)
      throw new ApplicationError('ineligible','Vídeo histórico perdeu integridade.');
    return {bytes,mime_type:historic.asset.file.mime_type,hash:historic.asset.file.hash};
  }
  async speechEditView(id:string){
    const p=await production(this.db,id),d=await dossier(this.db,p);
    return SpeechEditViewSchema.parse({production:{id,version:p.version},dossier:d?{id:d.id,version:d.version}:null,
      speeches:d?.blocks.flatMap(block=>block.speeches)??[],enabled:!!d&&(['ready_for_review','approved','exported'].includes(p.status)
        ||(p.status==='awaiting_decision'&&!d.assets.length&&!d.jobs.length))&&p.costs.committed_minor===0&&!await unfinishedExecutions(this.db,id),
      notice:'Alterar fala invalida áudio, cenas derivadas, legendas, montagem e aprovação. As referências de fonte são preservadas e devem ser conferidas para o novo texto.'});
  }
  async approvePlanning(raw:unknown){
    const request=ApprovePlanningSchema.parse(raw);
    return ProductionSchema.parse(await this.command(request.command_id,request,'approve_planning',async(client,p)=>{
      const d=await dossier(client,p);
      if(!d||!sameRef(d,request.dossier)||p.status!=='awaiting_decision'||d.assets.length||d.jobs.length||d.pending_issues.some(issue=>issue.required&&issue.code!=='editorial_review_required')
        ||d.approvals.some(approval=>approval.kind==='editorial'&&approval.status==='active'))throw new ApplicationError('ineligible','Aprovação exige planejamento atual, sem geração e com pendências resolvidas.');
      const snapshot=ProductionSnapshotSchema.parse((await client.query('SELECT record FROM production_snapshots WHERE production_id=$1',[p.id])).rows[0]?.record),{hash,...body}=snapshot;
      if(hash!==sha256(canonical(body))||snapshot.production_id!==p.id||inspectDossier(d,snapshot.article,snapshot.profile).some(issue=>issue.required))
        throw new ApplicationError('ineligible','Planejamento/fonte não corresponde ao snapshot válido.');
      const at=new Date().toISOString(),evaluationId=randomUUID(),target={id:d.id,version:d.version+1};
      const evaluation=EvaluationSchema.parse({id:evaluationId,version:1,created_at:at,author:'local_operator',changes:[],status:'approved',target,method:'human',
        criteria:[{name:'Fidelidade às fontes',mandatory:true,result:'pass',evidence:'Operador declarou conferência integral das fontes do roteiro indicado.',timecode_seconds:null,corrective_action:null},
          {name:'Direção e referências',mandatory:true,result:'pass',evidence:'Operador declarou revisão da intenção e direção das cenas indicadas.',timecode_seconds:null,corrective_action:null}]});
      const approvals=['editorial','direction'].map(kind=>ApprovalSchema.parse({id:randomUUID(),version:1,created_at:at,author:'local_operator',changes:[],status:'active',target,
        kind,reviewer:'local_operator',method:'human',reviewed_in_full:true,evaluation_refs:[{id:evaluationId,version:1}]}));
      const next=DossierSchema.parse({...d,version:target.version,created_at:at,status:'ready',pending_issues:d.pending_issues.filter(issue=>issue.code!=='editorial_review_required'),evaluations:[...d.evaluations,evaluation],approvals:[...d.approvals,...approvals]});
      await client.query('INSERT INTO production_dossiers(id,version,record) VALUES($1,$2,$3::jsonb)',[next.id,next.version,JSON.stringify(next)]);
      await saveMedia(client,p.id,'evaluation',evaluation,null);for(const approval of approvals)await saveMedia(client,p.id,'approval',approval,null);
      return appendProduction(client,p,{dossier:target,pending_issues:[...p.pending_issues.filter(issue=>!['audiovisual_gate_pending','provider_setup_pending','planning_review_pending','editorial_review_required'].includes(issue.code)),
        {code:'provider_setup_pending',message:'Planejamento aprovado; conexões de geração e custo ainda precisam estar liberadas.',next_action:'Configurar adapters, acesso e estimativas no servidor antes de iniciar mídia.',required:true}]},
        'planning_approved','Revisão humana do roteiro e direção registrada; aprovação não autoriza gasto desconhecido.');
    }));
  }
  /** Chamada do runtime provisionado após conferir conexões; orçamento ainda é reservado pela fila. */
  async beginGeneration(raw:unknown){
    const request=ApprovePlanningSchema.omit({reviewed_sources:true,reviewed_direction:true}).parse(raw);
    return ProductionSchema.parse(await this.command(request.command_id,request,'begin_generation',async(client,p)=>{
      const d=await dossier(client,p);
      if(!d||!sameRef(d,request.dossier)||p.status!=='awaiting_decision'||d.pending_issues.some(issue=>issue.required)
        ||p.pending_issues.some(issue=>issue.required&&issue.code!=='provider_setup_pending')||p.costs.committed_minor!==0
        ||!['editorial','direction'].every(kind=>d.approvals.some(approval=>approval.kind===kind&&approval.status==='active'&&sameRef(approval.target,d)
          &&approval.evaluation_refs.every(ref=>d.evaluations.some(e=>sameRef(e,ref)&&sameRef(e.target,d)&&e.method==='human'&&e.status==='approved')))))
        throw new ApplicationError('ineligible','Geração exige planejamento aprovado exato e pendências resolvidas.');
      return appendProduction(client,p,{status:'producing',stage:'generation',pending_issues:p.pending_issues.filter(issue=>issue.code!=='provider_setup_pending')},'generation_started','Pipeline ativado; cada operação exige admissão e reserva antes do envio.');
    }));
  }
  async editSpeech(raw:unknown){
    const request=EditSpeechSchema.parse(raw);
    const replay=(await this.db.query('SELECT fingerprint,result FROM review_commands WHERE command_id=$1',[request.command_id])).rows[0];
    if(replay){if(replay.fingerprint!==sha256(canonical({action:'edit_speech',raw:request})))throw new ApplicationError('conflict','Comando reutilizado com outra intenção.');return ProductionSchema.parse(replay.result);}
    const sourceProduction=await production(this.db,request.production.id),sourceDossier=await dossier(this.db,sourceProduction);
    if(!sourceDossier||!sameRef(sourceProduction,request.production)||!sameRef(sourceDossier,request.dossier))throw new ApplicationError('conflict','Fonte da edição alterada.');
    const sourceSnapshot=ProductionSnapshotSchema.parse((await this.db.query('SELECT record FROM production_snapshots WHERE production_id=$1',[sourceProduction.id])).rows[0]?.record);
    const sourceAudit=await this.sourceReauditor?.audit({command_id:request.command_id,production:request.production,dossier:sourceDossier,snapshot:sourceSnapshot,speech_id:request.speech_id,text:request.text});
    return ProductionSchema.parse(await this.command(request.command_id,request,'edit_speech',async(client,p)=>{
      const d=await dossier(client,p);
      const planning=p.status==='awaiting_decision'&&d&&!d.assets.length&&!d.jobs.length;
      if(!d||!sameRef(d,request.dossier)||(!planning&&!['ready_for_review','approved','exported'].includes(p.status))||p.costs.committed_minor!==0
        ||d.jobs.some(job=>['queued','running','unknown'].includes(job.status)||job.costs.confirmed_minor===null)||await unfinishedExecutions(client,p.id))
        throw new ApplicationError('ineligible','Edição exige dossiê atual e nenhum job ou custo pendente.');
      const speech=d.blocks.flatMap(block=>block.speeches).find(s=>s.id===request.speech_id);
      if(!speech)throw new ApplicationError('not_found','Fala não encontrada no dossiê.');
      if(speech.text===request.text)throw new ApplicationError('validation','O texto não foi alterado.');
      const snapshot=ProductionSnapshotSchema.parse((await client.query('SELECT record FROM production_snapshots WHERE production_id=$1',[p.id])).rows[0]?.record);
      const {hash,...body}=snapshot;
      if(hash!==sha256(canonical(body))||snapshot.production_id!==p.id)throw new ApplicationError('ineligible','Snapshot da fonte inconsistente.');
      const edited={...d,blocks:d.blocks.map(block=>({...block,speeches:block.speeches.map(s=>s.id===speech.id?{...s,text:request.text}:s)}))};
      const sourceErrors=inspectDossier(edited,snapshot.article,snapshot.profile).filter(issue=>['source_missing','editorial_source_unapproved','article_revision_mismatch','profile_revision_mismatch','character_revision_mismatch'].includes(issue.code));
      if(sourceErrors.length)throw new ApplicationError('ineligible','Fontes da nova fala precisam de revisão válida antes de persistir.');
      const next=invalidateDossier(edited,[{id:d.id,version:d.version}]),at=new Date().toISOString();
      if(sourceAudit){
        if(sourceAudit.snapshot_hash!==snapshot.hash||!sameRef(sourceAudit.dossier,d)||!sameRef(sourceAudit.production,p)||sourceAudit.edited_text_hash!==sha256(request.text))throw new ApplicationError('conflict','Evidência semântica não corresponde à edição atual.');
        next.pending_issues=[...next.pending_issues.filter(issue=>!issue.code.includes('source_reaudit')), ...sourceAudit.issues];
        await client.query('INSERT INTO source_edit_audits(command_id,production_id,record) VALUES($1,$2,$3::jsonb)',[request.command_id,p.id,JSON.stringify(sourceAudit)]);
      }
      if(planning){next.status='specified';next.pending_issues=next.pending_issues.filter(issue=>issue.code!=='correction_dependencies_outdated');}
      next.changes.push({at,author:'local_operator',reason:`${request.reason}; operador declarou conferência das fontes preservadas da fala ${speech.id}.`});
      const writes:MediaWrite[]=[];
      for(const asset of next.assets){const old=d.assets.find(a=>a.id===asset.id)!;if(asset.version!==old.version)writes.push({kind:'asset',record:asset,expected_version:old.version});}
      if(next.timeline&&d.timeline&&next.timeline.version!==d.timeline.version)writes.push({kind:'timeline',record:next.timeline,expected_version:d.timeline.version});
      for(const approval of next.approvals){const old=d.approvals.find(a=>a.id===approval.id)!;if(approval.version!==old.version)writes.push({kind:'approval',record:approval,expected_version:old.version});}
      if(writes.length)await new PostgresMediaStore(this.db,this.files).commitWithin(client,p.id,writes);
      await client.query('INSERT INTO production_dossiers(id,version,record) VALUES($1,$2,$3::jsonb)',[next.id,next.version,JSON.stringify(next)]);
      if(p.current_render){
        const correction=CorrectionSchema.parse({id:randomUUID(),version:1,created_at:at,author:'local_operator',changes:[],status:'proposed',
          production:{id:p.id,version:p.version},render:p.current_render,shot:null,category:'speech_voice',comment:request.reason,
          impact:correctionImpact(d,[{id:d.id,version:d.version}]),costs:{...p.costs,estimated_minor:null},additional_cost_authorized:false});
        await client.query('INSERT INTO correction_proposal_heads(id,production_id,point_id,version) VALUES($1,$2,NULL,1)',[correction.id,p.id]);
        await client.query('INSERT INTO correction_proposal_revisions(id,version,record) VALUES($1,1,$2::jsonb)',[correction.id,JSON.stringify(correction)]);
      }
      return appendProduction(client,p,{status:planning?'awaiting_decision':'correcting',stage:planning?'script_direction':'generation',dossier:{id:next.id,version:next.version},current_render:null,current_approval:null,
        pending_issues:[...p.pending_issues.filter(i=>i.code!=='correction_dependencies_outdated'&&(!planning||i.code!=='provider_setup_pending')),
          ...(planning?[{code:'planning_review_pending',message:'Fala alterada; conferir novamente roteiro e direção.',next_action:'Revisar a nova versão do planejamento.',required:true}]:next.pending_issues.filter(i=>i.code==='correction_dependencies_outdated'))]},
        'speech_edited','Fala alterada; derivados e aprovação invalidados atomicamente, sem iniciar gasto.');
    }));
  }
  async review(id: string) {
    const p=await production(this.db,id),d=await dossier(this.db,p),render=await this.render(this.db,p,d),allPoints=await points(this.db,id);
    const comment=!!render&&p.status==='ready_for_review';
    let approve=false;
    if(render&&render.usage.permission==='allowed'&&d&&p.status==='ready_for_review'&&!allPoints.some(point=>point.status==='open')
      &&!p.pending_issues.some(i=>i.required)&&!d.pending_issues.some(i=>i.required)&&p.costs.committed_minor===0
      &&!d.jobs.some(job=>['queued','running','unknown'].includes(job.status)||job.costs.confirmed_minor===null)&&!await unfinishedExecutions(this.db,id)) approve=true;
    return ReviewViewSchema.parse({production:{id:p.id,version:p.version},name:p.name,status:p.status,
      render:render?{ref:{id:render.id,version:render.version},hash:render.file.hash,preview_url:mediaUrl(id,render),duration_seconds:render.file.duration_seconds}:null,
      scenes:render&&d?this.scenes(d):[],points:allPoints,corrections:(await this.db.query('SELECT r.record FROM correction_proposal_revisions r JOIN correction_proposal_heads h USING(id,version) WHERE h.production_id=$1 ORDER BY h.id',[id])).rows.map(row=>CorrectionSchema.parse(row.record)),
      correction_plans:(await this.db.query('SELECT correction_id,hash FROM correction_execution_plans WHERE production_id=$1 ORDER BY id',[id])).rows,
      actions:{comment:{enabled:comment,reason:comment?null:'Apontamentos exigem prévia íntegra em revisão.'},
        approve:{enabled:approve,reason:approve?null:'Aprovação exige prévia íntegra, pendências resolvidas e custos reconciliados.'}},
      notice:render?'Prévia da revisão indicada; revisar o vídeo integral antes de aprovar.':'Prévia ainda indisponível. A produção precisa de mídia íntegra e montagem concluída.'});
  }
  private async command<T>(id:string,raw:unknown,action:string,run:(client:SqlClient,p:Production)=>Promise<T>) {
    const fingerprint=sha256(canonical({action,raw}));
    return this.db.transaction(async client=>{
      await client.query('INSERT INTO review_commands(command_id,fingerprint) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,fingerprint]);
      const old=(await client.query('SELECT fingerprint,result FROM review_commands WHERE command_id=$1 FOR UPDATE',[id])).rows[0]!;
      if(old.fingerprint!==fingerprint) throw new ApplicationError('conflict','Chave já utilizada com outra intenção.');
      if(old.result!==null) return old.result as T;
      const ref=(raw as {production:VersionRef}).production;
      const p=await production(client,ref.id,true);
      if(!sameRef(p,ref)) throw new ApplicationError('conflict','Produção mudou; atualize a revisão.');
      const result=await run(client,p);
      await client.query('UPDATE review_commands SET result=$2::jsonb WHERE command_id=$1',[id,JSON.stringify(result)]);
      return result;
    });
  }
  async addPoint(raw:unknown) {
    const request=CreateReviewPointSchema.parse(raw);
    return ReviewPointSchema.parse(await this.command(request.command_id,request,'add_point',async(client,p)=>{
      const d=await dossier(client,p),render=await this.render(client,p,d);
      if(p.status!=='ready_for_review'||!render||!sameRef(render,request.render)||render.file.hash!==request.render_hash)
        throw new ApplicationError('ineligible','Prévia ou revisão do apontamento não está disponível.');
      if(request.at_seconds>render.file.duration_seconds!) throw new ApplicationError('validation','Timecode fora do vídeo.');
      if(request.shot&&!this.scenes(d!).some(scene=>sameRef(scene.ref,request.shot!)&&request.at_seconds>=scene.start_seconds&&request.at_seconds<=scene.end_seconds))
        throw new ApplicationError('validation','Cena não corresponde ao trecho apontado.');
      const {command_id,...data}=request;
      const point=ReviewPointSchema.parse({...data,id:randomUUID(),version:1,created_at:new Date().toISOString(),status:'open',resolution:null,reviewer:'local_operator'});
      await client.query('INSERT INTO review_point_heads(id,production_id,version) VALUES($1,$2,1)',[point.id,p.id]);
      await client.query('INSERT INTO review_point_revisions(id,version,record) VALUES($1,1,$2::jsonb)',[point.id,JSON.stringify(point)]);
      await appendProduction(client,p,{pending_issues:[...p.pending_issues,{code:`review_point:${point.id}`,message:point.comment,next_action:'Resolver o apontamento antes da aprovação final.',required:true}]},'review_point_created','Apontamento registrado na revisão assistida.');
      return point;
    }));
  }
  async resolvePoint(raw:unknown) {
    const request=ResolveReviewPointSchema.parse(raw);
    return ReviewPointSchema.parse(await this.command(request.command_id,request,'resolve_point',async(client,p)=>{
      const point=(await points(client,p.id)).find(point=>sameRef(point,request.point));
      if(!point||point.status!=='open'||p.status!=='ready_for_review') throw new ApplicationError('conflict','Apontamento não está aberto nesta revisão.');
      if(request.status==='addressed'&&(!p.current_render||sameRef(p.current_render,point.render)))
        throw new ApplicationError('ineligible','Correção exige uma nova revisão do render.');
      const next=ReviewPointSchema.parse({...point,version:point.version+1,status:request.status,resolution:request.reason});
      await client.query('INSERT INTO review_point_revisions(id,version,record) VALUES($1,$2,$3::jsonb)',[point.id,next.version,JSON.stringify(next)]);
      await client.query('UPDATE review_point_heads SET version=$2 WHERE id=$1',[point.id,next.version]);
      await appendProduction(client,p,{pending_issues:p.pending_issues.filter(i=>i.code!==`review_point:${point.id}`)},'review_point_resolved','Decisão de revisão registrada com justificativa.');
      return next;
    }));
  }
  async approve(raw:unknown) {
    const request=ApproveReviewSchema.parse(raw);
    return ProductionSchema.parse(await this.command(request.command_id,request,'approve_final',async(client,p)=>{
      const d=await dossier(client,p),render=await this.render(client,p,d);
      if(p.status!=='ready_for_review'||!d||!render||!sameRef(render,request.render)||render.file.hash!==request.render_hash
        ||render.usage.permission!=='allowed'||p.pending_issues.some(i=>i.required)||d.pending_issues.some(i=>i.required)
        ||(await points(client,p.id)).some(point=>point.status==='open')||p.costs.committed_minor!==0
        ||d.jobs.some(job=>['queued','running','unknown'].includes(job.status)||job.costs.confirmed_minor===null)||await unfinishedExecutions(client,p.id))
        throw new ApplicationError('ineligible','Aprovação exige render exato, direitos, pendências resolvidas e custos reconciliados.');
      const at=new Date().toISOString(),evaluationId=randomUUID(),approvalId=randomUUID();
      const approved=AssetSchema.parse({...render,version:render.version+1,status:'approved',created_at:at,
        changes:[...render.changes,{at,author:'local_operator',reason:`Revisão integral declarada para ${render.id}:v${render.version}, hash ${render.file.hash}; bytes preservados.`}],evaluation_refs:[{id:evaluationId,version:1}]});
      const evaluation=EvaluationSchema.parse({id:evaluationId,version:1,created_at:at,author:'local_operator',changes:[],status:'approved',target:{id:approved.id,version:approved.version},method:'human',
        criteria:[{name:'Revisão integral declarada',mandatory:true,result:'pass',evidence:`Declaração do operador local; render assistido v${render.version}, SHA-256 ${render.file.hash}.`,timecode_seconds:null,corrective_action:null}]});
      const approval=ApprovalSchema.parse({id:approvalId,version:1,created_at:at,author:'local_operator',changes:[],status:'active',target:{id:approved.id,version:approved.version},kind:'final',reviewer:'local_operator',method:'human',reviewed_in_full:true,evaluation_refs:[{id:evaluationId,version:1}]});
      await saveMedia(client,p.id,'asset',approved,render.version); await saveMedia(client,p.id,'evaluation',evaluation,null); await saveMedia(client,p.id,'approval',approval,null);
      const nextDossier=DossierSchema.parse({...d,version:d.version+1,created_at:at,assets:d.assets.map(asset=>sameRef(asset,render)?approved:asset),evaluations:[...d.evaluations,evaluation],approvals:[...d.approvals,approval]});
      await client.query('INSERT INTO production_dossiers(id,version,record) VALUES($1,$2,$3::jsonb)',[d.id,nextDossier.version,JSON.stringify(nextDossier)]);
      return appendProduction(client,p,{status:'approved',stage:'delivery',current_render:{id:approved.id,version:approved.version},current_approval:{id:approval.id,version:approval.version},dossier:{id:d.id,version:nextDossier.version}},'final_approved','Aprovação humana vinculada aos bytes da revisão integral declarada.');
    }));
  }
  async proposeCorrection(raw:unknown) {
    const request=ProposeCorrectionSchema.parse(raw);
    return CorrectionSchema.parse(await this.command(request.command_id,request,'propose_correction',async(client,p)=>{
      const d=await dossier(client,p),render=await this.render(client,p,d),point=(await points(client,p.id)).find(point=>sameRef(point,request.point));
      if(!d||!render||p.status!=='ready_for_review'||!point||point.status!=='open'||!sameRef(point.render,render))
        throw new ApplicationError('ineligible','Correção exige apontamento aberto no render atual.');
      const existing=(await client.query('SELECT r.record FROM correction_proposal_revisions r JOIN correction_proposal_heads h USING(id,version) WHERE h.production_id=$1 AND h.point_id=$2',[p.id,point.id])).rows[0];
      if(existing) return CorrectionSchema.parse(existing.record);
      const visual=['image_mismatch','identity','environment','motion'].includes(point.category);
      if(visual&&!point.shot) throw new ApplicationError('ineligible','Correção visual exige apontamento vinculado à cena.');
      const segment=point.shot?d.timeline!.video.find(segment=>sameRef(segment.shot,point.shot!)&&point.at_seconds>=segment.start_seconds&&point.at_seconds<=segment.end_seconds):null;
      const root=visual?segment?.asset:{id:d.id,version:d.version};
      if(!root) throw new ApplicationError('ineligible','Não há mídia da cena para calcular o impacto.');
      const at=new Date().toISOString(),proposal=CorrectionSchema.parse({id:randomUUID(),version:1,created_at:at,author:'local_operator',changes:[],status:'proposed',
        production:{id:p.id,version:p.version},render:{id:render.id,version:render.version},shot:point.shot,category:point.category,comment:point.comment,
        impact:correctionImpact(d,[root]),costs:{...p.costs,estimated_minor:null},additional_cost_authorized:false});
      await client.query('INSERT INTO correction_proposal_heads(id,production_id,point_id,version) VALUES($1,$2,$3,1)',[proposal.id,p.id,point.id]);
      await client.query('INSERT INTO correction_proposal_revisions(id,version,record) VALUES($1,1,$2::jsonb)',[proposal.id,JSON.stringify(proposal)]);
      await appendProduction(client,p,{pending_issues:[...p.pending_issues,{code:`correction_cost:${proposal.id}`,message:'Correção proposta; custo ainda não estimado.',next_action:'Obter limite seguro da operação e autorizar o plano antes de executar.',required:true}]},'correction_proposed','Impacto da correção calculado; nenhuma geração iniciada.');
      return proposal;
    }));
  }
  async cancelCorrection(raw:unknown){
    const request=CancelCorrectionSchema.parse(raw);
    return CorrectionSchema.parse(await this.command(request.command_id,request,'cancel_correction',async(client,p)=>{
      const row=(await client.query('SELECT r.record FROM correction_proposal_revisions r JOIN correction_proposal_heads h USING(id,version) WHERE h.production_id=$1 AND h.id=$2',[p.id,request.correction.id])).rows[0];
      if(!row)throw new ApplicationError('not_found','Plano de correção não encontrado.');
      const current=CorrectionSchema.parse(row.record);
      if(!sameRef(current,request.correction)||!['proposed','awaiting_cost_authorization','authorized'].includes(current.status))
        throw new ApplicationError('conflict','Plano já alterado ou execução iniciada.');
      const at=new Date().toISOString(),next=CorrectionSchema.parse({...current,version:current.version+1,status:'cancelled',created_at:at,
        changes:[...current.changes,{at,author:'local_operator',reason:request.reason}]});
      await client.query('INSERT INTO correction_proposal_revisions(id,version,record) VALUES($1,$2,$3::jsonb)',[next.id,next.version,JSON.stringify(next)]);
      await client.query('UPDATE correction_proposal_heads SET version=$2 WHERE id=$1',[next.id,next.version]);
      await appendProduction(client,p,{pending_issues:p.pending_issues.filter(issue=>issue.code!==`correction_cost:${next.id}`)},'correction_cancelled','Plano de correção cancelado antes de execução; apontamento mantém decisão própria.');
      return next;
    }));
  }
  private async correction(client:SqlClient,id:string,ref:VersionRef){
    const row=(await client.query('SELECT r.record FROM correction_proposal_revisions r JOIN correction_proposal_heads h USING(id,version) WHERE h.production_id=$1 AND h.id=$2',[id,ref.id])).rows[0];
    if(!row)throw new ApplicationError('not_found','Plano de correção não encontrado.');
    const value=CorrectionSchema.parse(row.record);if(!sameRef(value,ref))throw new ApplicationError('conflict','Plano de correção alterado.');return value;
  }
  private async reviseCorrection(client:SqlClient,current:Correction,patch:Partial<Correction>){
    const next=CorrectionSchema.parse({...current,...patch,version:current.version+1,created_at:new Date().toISOString()});
    await client.query('INSERT INTO correction_proposal_revisions(id,version,record) VALUES($1,$2,$3::jsonb)',[next.id,next.version,JSON.stringify(next)]);
    await client.query('UPDATE correction_proposal_heads SET version=$2 WHERE id=$1',[next.id,next.version]);return next;
  }
  /** Plano fornecido pelo planejador interno/adapter; nunca aceita preço ou intenção arbitrários pelo endpoint público. */
  async estimateCorrection(raw:unknown){
    const plan=CorrectionExecutionPlanSchema.parse(raw),{hash,...body}=plan;
    if(hash!==sha256(canonical(body)))throw new ApplicationError('validation','Hash do plano de correção inválido.');
    return this.db.transaction(async client=>{
      const p=await production(client,plan.production.id,true),d=await dossier(client,p);
      const existing=(await client.query('SELECT record FROM correction_execution_plans WHERE correction_id=$1 AND hash=$2',[plan.correction.id,plan.hash])).rows[0];
      if(existing)return CorrectionExecutionPlanSchema.parse(existing.record);
      const correction=await this.correction(client,p.id,plan.correction);
      const editedSpeech=correction.category==='speech_voice'&&p.status==='correcting'&&p.stage==='generation'&&d?.status==='outdated'&&!p.current_render;
      if(!sameRef(p,plan.production)||!d||!sameRef(d,plan.dossier)||correction.status!=='proposed'
        ||(!editedSpeech&&(p.status!=='ready_for_review'||!p.current_render||!sameRef(p.current_render,correction.render))))throw new ApplicationError('conflict','Correção não corresponde à revisão atual.');
      const visual=['image_mismatch','identity','environment','motion'].includes(correction.category);
      const root=visual?d.timeline?.video.find(segment=>correction.shot&&sameRef(segment.shot,correction.shot))?.asset:{id:d.id,version:d.version};
      if(!root||plan.roots.length!==1||!sameRef(plan.roots[0]!,root))throw new ApplicationError('validation','Raiz do plano difere do impacto proposto.');
      const keys=new Set<string>();let total=0;
      for(const intent of plan.intents){
        if(intent.request.production.id!==p.id||intent.request.currency!==p.costs.currency||!intent.estimate.evidence.trim())throw new ApplicationError('validation','Intenção de correção incompatível.');
        const key=`${intent.request.execution_key}:${intent.request.attempt}`;if(keys.has(key))throw new ApplicationError('validation','Plano repete operação.');keys.add(key);
        if(visual&&(!intent.request.shot||!correction.shot||!sameRef(intent.request.shot,correction.shot)||!['image','animation','avatar'].includes(intent.request.operation)))
          throw new ApplicationError('validation','Correção visual deve preservar fala e escopo da cena.');
        total+=intent.estimate.upper_minor;
      }
      if(!Number.isSafeInteger(total)||budgetPreflight(p.costs,total).length)throw new ApplicationError('budget_exceeded','Plano excede saldo seguro disponível.');
      await client.query('INSERT INTO correction_execution_plans(id,correction_id,production_id,hash,record) VALUES($1,$2,$3,$4,$5::jsonb)',[plan.id,correction.id,p.id,hash,JSON.stringify(plan)]);
      await this.reviseCorrection(client,correction,{status:'awaiting_cost_authorization',costs:{...correction.costs,estimated_minor:total}});
      await appendProduction(client,p,{},'correction_estimated','Plano de correção estimado e fixado; aguarda autorização explícita do limite.');return plan;
    });
  }
  async authorizeCorrection(raw:unknown){
    const request=AuthorizeCorrectionSchema.parse(raw);
    return CorrectionSchema.parse(await this.command(request.command_id,request,'authorize_correction',async(client,p)=>{
      const correction=await this.correction(client,p.id,request.correction);
      const row=(await client.query('SELECT record FROM correction_execution_plans WHERE correction_id=$1 AND hash=$2 AND production_id=$3',[correction.id,request.plan_hash,p.id])).rows[0];
      if(!row||correction.status!=='awaiting_cost_authorization'||correction.costs.estimated_minor===null||request.maximum_minor<correction.costs.estimated_minor
        ||budgetPreflight(p.costs,correction.costs.estimated_minor).length)throw new ApplicationError('ineligible','Autorização exige plano estimado exato dentro do saldo e limite informado.');
      const plan=CorrectionExecutionPlanSchema.parse(row.record);
      const editedSpeech=correction.category==='speech_voice'&&p.status==='correcting'&&p.stage==='generation'&&!p.current_render;
      if(!p.dossier||!sameRef(p.dossier,plan.dossier)||(!editedSpeech&&(!p.current_render||!sameRef(p.current_render,correction.render))))throw new ApplicationError('conflict','Plano ficou desatualizado.');
      const next=await this.reviseCorrection(client,correction,{status:'authorized',additional_cost_authorized:true});
      await appendProduction(client,p,{},'correction_authorized','Limite do plano exato autorizado pelo operador; execução ainda não iniciada.');return next;
    }));
  }
  async executeCorrection(raw:unknown){
    const request=ExecuteCorrectionSchema.parse(raw);
    return CorrectionSchema.parse(await this.command(request.command_id,request,'execute_correction',async(client,p)=>{
      const correction=await this.correction(client,p.id,request.correction),d=await dossier(client,p);
      const row=(await client.query('SELECT record FROM correction_execution_plans WHERE correction_id=$1 AND hash=$2 AND production_id=$3',[correction.id,request.plan_hash,p.id])).rows[0];
      const editedSpeech=correction.category==='speech_voice'&&p.status==='correcting'&&p.stage==='generation'&&d?.status==='outdated'&&!p.current_render;
      if(!row||!d||correction.status!=='authorized'||(!editedSpeech&&(p.status!=='ready_for_review'||!p.current_render||!sameRef(p.current_render,correction.render))))
        throw new ApplicationError('ineligible','Execução exige plano autorizado na revisão atual.');
      const plan=CorrectionExecutionPlanSchema.parse(row.record);
      if(!sameRef(d,plan.dossier))throw new ApplicationError('conflict','Dossiê do plano alterado.');
      const next=editedSpeech?d:invalidateDossier(d,plan.roots),writes:MediaWrite[]=[];
      for(const asset of next.assets){const old=d.assets.find(a=>a.id===asset.id)!;if(asset.version!==old.version)writes.push({kind:'asset',record:asset,expected_version:old.version});}
      if(next.timeline&&d.timeline&&next.timeline.version!==d.timeline.version)writes.push({kind:'timeline',record:next.timeline,expected_version:d.timeline.version});
      for(const approval of next.approvals){const old=d.approvals.find(a=>a.id===approval.id)!;if(approval.version!==old.version)writes.push({kind:'approval',record:approval,expected_version:old.version});}
      if(writes.length)await new PostgresMediaStore(this.db,this.files).commitWithin(client,p.id,writes);
      if(!editedSpeech)await client.query('INSERT INTO production_dossiers(id,version,record) VALUES($1,$2,$3::jsonb)',[next.id,next.version,JSON.stringify(next)]);
      const started=await appendProduction(client,p,{status:'correcting',stage:'generation',dossier:{id:next.id,version:next.version},current_render:null,current_approval:null,
        pending_issues:[...p.pending_issues.filter(issue=>issue.code!==`correction_cost:${correction.id}`),...next.pending_issues.filter(issue=>issue.code==='correction_dependencies_outdated')]},'correction_started','Correção iniciou com reserva atômica de todas as operações do plano.');
      await new PostgresGenerationQueue(this.db,this.admission).enqueueBatchWithin(client,plan.intents.map(intent=>({...intent,request:{...intent.request,production:{id:p.id,version:started.version}}})));
      return this.reviseCorrection(client,correction,{status:'running'});
    }));
  }
  /** Entrada do reconciliador de mídia após copiar, medir e avaliar os outputs exatos; não há endpoint público de inserção. */
  async publishCorrectionAssets(raw:unknown){
    const request=PublishCorrectionAssetsSchema.parse(raw);
    return ProductionSchema.parse(await this.command(request.command_id,request,'publish_correction_assets',async(client,p)=>{
      const correction=await this.correction(client,p.id,request.correction),d=await dossier(client,p);
      if(!d||correction.status!=='running'||p.status!=='correcting'||p.stage!=='generation'||p.costs.committed_minor!==0)
        throw new ApplicationError('ineligible','Mídia corrigida exige execução ativa e custos reconciliados.');
      const jobs=(await client.query('SELECT r.record FROM generation_revisions r JOIN generation_heads h USING(id,version) WHERE h.production_id=$1',[p.id])).rows.map(row=>GenerationExecutionSchema.parse(row.record)),
        plans=(await client.query('SELECT record FROM correction_execution_plans WHERE correction_id=$1 AND production_id=$2',[correction.id,p.id])).rows;
      const keys=new Set(plans.flatMap(row=>CorrectionExecutionPlanSchema.parse(row.record).intents.map(intent=>intent.request.execution_key)));
      const executions=[...keys].map(key=>jobs.filter(job=>job.intent.request.execution_key===key).sort((a,b)=>b.intent.request.attempt-a.intent.request.attempt)[0]!).filter(Boolean);
      if(executions.length!==keys.size||executions.some(job=>job.state!=='succeeded'||!job.provider_job||job.provider_job.costs.confirmed_minor===null))
        throw new ApplicationError('ineligible','Todos os resultados do plano precisam estar concluídos e reconciliados.');
      if(new Set(request.replacements.map(pair=>pair.previous.id)).size!==request.replacements.length||new Set(request.replacements.map(pair=>pair.next.id)).size!==request.replacements.length)
        throw new ApplicationError('validation','Substituição de mídia duplicada.');
      const replacements=new Map<string,Asset>();
      for(const pair of request.replacements){
        const old=d.assets.find(asset=>sameRef(asset,pair.previous));
        if(!old||old.status!=='outdated'||!['audio','image','clip'].includes(old.type))throw new ApplicationError('ineligible','Substituição deve apontar ao input invalidado atual.');
        const row=(await client.query("SELECT r.record FROM media_revisions r JOIN media_heads h USING(kind,id,version) WHERE r.kind='asset' AND r.id=$1 AND r.version=$2 AND h.production_id=$3",[pair.next.id,pair.next.version,p.id])).rows[0];
        if(!row)throw new ApplicationError('ineligible','Output não pertence à produção ou está desatualizado.');
        const asset=AssetSchema.parse(row.record);
        if(asset.status!=='approved'||asset.usage.permission!=='allowed'||asset.type!==old.type||!await this.files.exists(asset)
          ||!asset.execution||!(await Promise.all(executions.map(job=>belongsToExecution(client,p.id,asset,job)))).some(Boolean))
          throw new ApplicationError('ineligible','Output exige arquivo íntegro, avaliação e proveniência do plano exato.');
        const shot=d.shots.find(shot=>shot.id===old.specification.id);
        const original=asset.type==='audio'?(await client.query('SELECT record FROM production_dossiers WHERE id=$1 AND version=$2',[asset.specification.id,asset.specification.version])).rows[0]:null;
        if(asset.type==='audio'?!audioSpecificationMatches(asset,d,original?[DossierSchema.parse(original.record)]:[]):!shot||!sameRef(asset.specification,shot))
          throw new ApplicationError('ineligible','Output não corresponde à fala/plano que será montado.');
        replacements.set(old.id,asset);
      }
      const outputIds=new Set([...replacements.values()].map(asset=>asset.id));
      const assets=d.assets.filter(asset=>!outputIds.has(asset.id)&&!(['render','subtitle'].includes(asset.type)&&asset.status==='outdated')).map(asset=>replacements.get(asset.id)??asset);
      if(assets.some(asset=>['audio','image','clip'].includes(asset.type)&&asset.status==='outdated'))throw new ApplicationError('ineligible','Ainda há inputs invalidados sem substituição.');
      const at=new Date().toISOString(),next=DossierSchema.parse({...d,version:d.version+1,created_at:at,status:'ready',timeline:null,assets,
        jobs:[...d.jobs.filter(job=>!executions.some(execution=>execution.provider_job?.id===job.id)),...executions.map(execution=>execution.provider_job!)],
        pending_issues:d.pending_issues.filter(issue=>issue.code!=='correction_dependencies_outdated')});
      // Avaliações já persistidas do output são copiadas para o dossiê, sem inventar aceite.
      for(const asset of replacements.values())for(const ref of asset.evaluation_refs){
        const row=(await client.query("SELECT r.record FROM media_revisions r JOIN media_heads h USING(kind,id) WHERE r.kind='evaluation' AND r.id=$1 AND r.version=$2 AND h.production_id=$3",[ref.id,ref.version,p.id])).rows[0];
        if(!row)throw new ApplicationError('ineligible','Avaliação do output ausente.');
        const evaluation=EvaluationSchema.parse(row.record);
        if(!sameRef(evaluation.target,asset)||evaluation.status!=='approved'||evaluation.method==='model_signal')throw new ApplicationError('ineligible','Avaliação do output incompatível.');
        if(!next.evaluations.some(e=>sameRef(e,evaluation)))next.evaluations.push(evaluation);
      }
      await client.query('INSERT INTO production_dossiers(id,version,record) VALUES($1,$2,$3::jsonb)',[next.id,next.version,JSON.stringify(next)]);
      return appendProduction(client,p,{stage:'assembly',dossier:{id:next.id,version:next.version},pending_issues:p.pending_issues.filter(issue=>issue.code!=='correction_dependencies_outdated')},
        'correction_completed','Outputs avaliados publicados; nova montagem e revisão integral ainda necessárias.');
    }));
  }
  async delivery(id:string) {
    const p=await production(this.db,id),d=await dossier(this.db,p),render=await this.render(this.db,p,d);
    let enabled=false;
    if(render&&d) {try {const manifest=buildDeliveryManifest(p,d,'approved_delivery',subtitleRefs(d));
      enabled=(await Promise.all(manifest.assets.map(asset=>this.files.exists(asset)))).every(Boolean)&&!await unfinishedExecutions(this.db,id);} catch { /* Motivo apresentado como ação indisponível. */ }}
    const files=render?[{ref:{id:render.id,version:render.version},label:enabled?'Vídeo aprovado':'Prévia',download_url:mediaUrl(id,render)}]:[];
    if(render&&d)for(const ref of subtitleRefs(d)){
      const asset=d.assets.find(asset=>sameRef(asset,ref))!;
      if(await this.files.exists(asset))files.push({ref,label:asset.file.mime_type==='text/vtt'?'Legendas VTT':'Legendas SRT',download_url:`${mediaUrl(id,ref)}&download=1`});
    }
    const saved=(await this.db.query('SELECT id FROM delivery_manifests WHERE production_id=$1 AND render_id=$2 AND render_version=$3 ORDER BY id LIMIT 1',[id,render?.id??'',render?.version??0])).rows[0];
    if(saved&&enabled) files.push({ref:{id:String(saved.id),version:1},label:'Manifesto',download_url:`/api/productions/${encodeURIComponent(id)}/manifests/${encodeURIComponent(String(saved.id))}`});
    return DeliveryViewSchema.parse({production:{id:p.id,version:p.version},name:p.name,status:p.status,kind:render?enabled?'approved_delivery':'preview':'unavailable',render:render?{id:render.id,version:render.version}:null,render_hash:render?.file.hash??null,
      files,costs:p.costs,export_action:{enabled,reason:enabled?null:'Entrega exige aprovação humana do render atual e arquivos íntegros.'},notice:enabled?'Render aprovado na revisão indicada.':'Prévia e entrega aprovada são estados distintos; resolver as pendências antes de exportar.'});
  }
  async export(raw:unknown) {
    const request=ExportDeliverySchema.parse(raw);
    return ProductionSchema.parse(await this.command(request.command_id,request,'export',async(client,p)=>{
      const d=await dossier(client,p),render=await this.render(client,p,d);
      if(!d||!render||!sameRef(render,request.render)||render.file.hash!==request.render_hash||await unfinishedExecutions(client,p.id)) throw new ApplicationError('ineligible','Render de entrega indisponível ou jobs ainda não reconciliados.');
      let manifest; try {manifest=buildDeliveryManifest(p,d,'approved_delivery',subtitleRefs(d));} catch {throw new ApplicationError('ineligible','Entrega exige aprovação humana válida e ausência de pendências.');}
      const stored=await storeDeliveryManifest(this.files,manifest);
      await client.query('INSERT INTO delivery_manifests(id,production_id,render_id,render_version,storage_key,hash,record) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT DO NOTHING',
        [manifest.id,p.id,render.id,render.version,stored.storage_key,stored.hash,JSON.stringify(manifest)]);
      return appendProduction(client,p,{status:'exported',stage:'delivery'},'exported','Manifesto e arquivos da revisão aprovada verificados para entrega.');
    }));
  }
  async asset(id:string,ref:VersionRef) {
    const p=await production(this.db,id),d=await dossier(this.db,p);
    let render=await this.render(this.db,p,d,ref);
    if(!render||!p.current_render||!sameRef(render,p.current_render)){
      const subtitle=d?.assets.find(asset=>sameRef(asset,ref)&&asset.type==='subtitle'&&d.timeline&&sameRef(asset.specification,d.timeline)
        &&!['outdated','rejected'].includes(asset.status)&&['text/vtt','application/x-subrip'].includes(asset.file.mime_type));
      const owned=(await this.db.query("SELECT r.record FROM media_revisions r JOIN media_heads h USING(kind,id,version) WHERE r.kind='asset' AND r.id=$1 AND r.version=$2 AND h.production_id=$3",[ref.id,ref.version,id])).rows[0];
      if(!subtitle||!owned||canonical(owned.record)!==canonical(subtitle)||!await this.render(this.db,p,d))
        throw new ApplicationError('not_found','Arquivo da revisão não disponível.');
      render=subtitle;
    }
    if(render.file.bytes>100_000_000) throw new ApplicationError('ineligible','Arquivo exige armazenamento com streaming para este tamanho.');
    const bytes=await this.files.read(render.file.storage_key);
    if(bytes.length!==render.file.bytes||sha256Bytes(bytes)!==render.file.hash) throw new ApplicationError('ineligible','Arquivo perdeu integridade.');
    return {bytes,mime_type:render.file.mime_type,hash:render.file.hash};
  }
  async manifest(id:string,manifestId:string) {
    const p=await production(this.db,id),d=await dossier(this.db,p);
    const row=(await this.db.query('SELECT record,storage_key,hash FROM delivery_manifests WHERE id=$1 AND production_id=$2',[manifestId,id])).rows[0];
    if(!row||!d||await unfinishedExecutions(this.db,id)) throw new ApplicationError('not_found','Manifesto não disponível.');
    const record=ExportManifestSchema.parse(row.record);
    try {buildDeliveryManifest(p,d,'approved_delivery');} catch {throw new ApplicationError('ineligible','Aprovação atual não permite esta entrega.');}
    if(!p.current_render||!sameRef(record.render,p.current_render)||!record.approval||!p.current_approval||!sameRef(record.approval,p.current_approval))
      throw new ApplicationError('ineligible','Manifesto não corresponde à revisão aprovada atual.');
    for(const asset of record.assets) if(!await this.files.exists(asset)) throw new ApplicationError('ineligible','Arquivo de entrega ausente.');
    const bytes=await this.files.read(String(row.storage_key));
    if(sha256Bytes(bytes)!==row.hash) throw new ApplicationError('ineligible','Manifesto perdeu integridade.');
    return bytes;
  }
}
const sha256Bytes=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
