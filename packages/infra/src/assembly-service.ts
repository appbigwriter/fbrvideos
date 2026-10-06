import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {IdSchema,VersionRefSchema,ProductionSchema,ProductionSnapshotSchema,DossierSchema,ApprovalSchema,CorrectionSchema,TimelineSchema,
  type AssetStore,type Production} from '@fbr/contracts';
import {ApplicationError,canonical,sha256,sameRef} from '@fbr/domain';
import {assembleTimeline,type AssemblyBindings} from '@fbr/pipeline';
import {PostgresMediaStore} from './media-store.js';
import {renderLocalPreview,type RenderExecutables} from './local-renderer.js';
import type {SqlDatabase} from './configuration-store.js';
import {storeTimelineSubtitles} from './subtitle-store.js';
const requestSchema=z.strictObject({command_id:IdSchema,production:VersionRefSchema,bindings:z.strictObject({
  audio:z.array(z.strictObject({speech_segment_id:IdSchema,asset:VersionRefSchema})).min(1),
  video:z.array(z.strictObject({shot:VersionRefSchema,asset:VersionRefSchema})).min(1),
  music:TimelineSchema.shape.music.optional(),transitions:TimelineSchema.shape.transitions.optional(),
})});
/** Entrada interna do pipeline: o operador continua selecionando artigo/perfil, sem montar bindings. */
export class LocalAssemblyService{
  constructor(private readonly db:SqlDatabase,private readonly files:AssetStore,private readonly tools?:RenderExecutables){}
  async assemble(raw:unknown):Promise<Production>{
    const request=requestSchema.parse(raw),fingerprint=sha256(canonical(request)),token=randomUUID();
    const claimed=await this.db.transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',[request.command_id]);
      const existing=(await client.query('SELECT fingerprint,state,result FROM assembly_runs WHERE command_id=$1',[request.command_id])).rows[0];
      if(existing){
        if(existing.fingerprint!==fingerprint)throw new ApplicationError('conflict','Comando de montagem reutilizado com outra intenção.');
        if(existing.state==='completed')return{result:ProductionSchema.parse(existing.result)};
        throw new ApplicationError('conflict','Montagem já iniciada; conferir estado antes de nova tentativa.');
      }
      const head=(await client.query('SELECT version FROM production_heads WHERE id=$1 FOR UPDATE',[request.production.id])).rows[0];
      if(!head)throw new ApplicationError('not_found','Produção não encontrada.');
      const p=ProductionSchema.parse((await client.query('SELECT record FROM production_revisions WHERE id=$1 AND version=$2',[request.production.id,head.version])).rows[0]?.record);
      if(!sameRef(p,request.production))throw new ApplicationError('conflict','Revisão da montagem desatualizada.');
      if(!['producing','correcting'].includes(p.status)||p.stage!=='assembly'||!p.dossier
        ||p.pending_issues.some(issue=>issue.required&&!issue.code.startsWith('review_point:'))||p.costs.committed_minor!==0)
        throw new ApplicationError('ineligible','Montagem exige geração concluída, custos reconciliados e gates resolvidos.');
      const snapshot=ProductionSnapshotSchema.parse((await client.query('SELECT record FROM production_snapshots WHERE production_id=$1',[p.id])).rows[0]?.record);
      const {hash,...snapshotContent}=snapshot;
      if(snapshot.production_id!==p.id||!sameRef(snapshot.article,p.article)||!sameRef(snapshot.profile,p.profile)||!sameRef(snapshot.character,p.character)
        ||hash!==sha256(canonical(snapshotContent)))throw new ApplicationError('ineligible','Snapshot da montagem inconsistente.');
      if(!snapshot.profile.delivery)throw new ApplicationError('ineligible','Formato de entrega não definido.');
      const d=DossierSchema.parse((await client.query('SELECT record FROM production_dossiers WHERE id=$1 AND version=$2',[p.dossier.id,p.dossier.version])).rows[0]?.record);
      if(d.production.id!==p.id||!sameRef(d.article,p.article)||!sameRef(d.profile,p.profile)||!sameRef(d.character,p.character)
        ||d.pending_issues.some(issue=>issue.required)||d.jobs.some(job=>job.production.id!==p.id||['queued','running','unknown'].includes(job.status)||job.costs.confirmed_minor===null))
        throw new ApplicationError('ineligible','Dossiê contém pendências ou jobs não reconciliados.');
      const count=Number((await client.query('SELECT count(*) AS count FROM assembly_runs WHERE production_id=$1 AND production_version=$2',[p.id,p.version])).rows[0]?.count??0);
      if((await client.query("SELECT 1 FROM generation_revisions r JOIN generation_heads h USING(id,version) WHERE h.production_id=$1 AND r.record->>'state' NOT IN ('succeeded','failed','cancelled') LIMIT 1",[p.id])).rows.length)
        throw new ApplicationError('ineligible','Montagem exige todos os jobs persistidos reconciliados, inclusive operações sem custo.');
      if(count>=(snapshot.profile.budget?.max_attempts_per_job??1))throw new ApplicationError('attempts_exceeded','Limite de tentativas locais de montagem atingido.');
      for(const ref of [...request.bindings.audio.map(binding=>binding.asset),...request.bindings.video.map(binding=>binding.asset),...(request.bindings.music??[]).map(segment=>segment.asset)]){
        const row=(await client.query("SELECT r.record FROM media_revisions r JOIN media_heads h USING(kind,id,version) WHERE h.kind='asset' AND h.id=$1 AND h.version=$2 AND h.production_id=$3",[ref.id,ref.version,p.id])).rows[0];
        const asset=d.assets.find(asset=>sameRef(asset,ref));
        if(!row||!asset||canonical(row.record)!==canonical(asset))throw new ApplicationError('ineligible','Input da montagem ausente, substituído ou de outra produção.');
      }
      await client.query("INSERT INTO assembly_runs(command_id,fingerprint,production_id,production_version,state,lease_token) VALUES($1,$2,$3,$4,'running',$5)",[request.command_id,fingerprint,p.id,p.version,token]);
      const previousDossiers=[];
      for(const version of new Set(d.assets.filter(asset=>asset.type==='audio'&&asset.specification.id===d.id&&asset.specification.version!==d.version).map(asset=>asset.specification.version))){
        const row=(await client.query('SELECT record FROM production_dossiers WHERE id=$1 AND version=$2',[d.id,version])).rows[0];
        if(row)previousDossiers.push(DossierSchema.parse(row.record));
      }
      return{p,d,delivery:snapshot.profile.delivery,previousDossiers};
    });
    if('result'in claimed)return claimed.result;
    try{
      const timeline=assembleTimeline(claimed.d,claimed.delivery,request.bindings as AssemblyBindings,claimed.previousDossiers);
      const render=await renderLocalPreview(claimed.d,timeline,this.files,this.tools,claimed.previousDossiers);
      const subtitles=await storeTimelineSubtitles(this.files,{...timeline,status:'rendered'});
      return await this.db.transaction(async client=>{
        const run=(await client.query('SELECT state,lease_token FROM assembly_runs WHERE command_id=$1 FOR UPDATE',[request.command_id])).rows[0];
        if(run?.state!=='running'||run.lease_token!==token)throw new ApplicationError('conflict','Montagem perdeu a posse da execução.');
        const head=(await client.query('SELECT version FROM production_heads WHERE id=$1 FOR UPDATE',[claimed.p.id])).rows[0];
        if(Number(head?.version)!==claimed.p.version)throw new ApplicationError('conflict','Produção mudou durante render; arquivo não foi publicado.');
        const at=new Date().toISOString(),renderedTimeline={...timeline,status:'rendered' as const};
        const media=new PostgresMediaStore(this.db,this.files);
        await media.commitWithin(client,claimed.p.id,[{kind:'timeline',record:renderedTimeline,expected_version:null},{kind:'asset',record:render,expected_version:null},
          ...subtitles.assets.map(record=>({kind:'asset' as const,record,expected_version:null})),
          ...subtitles.evaluations.map(record=>({kind:'evaluation' as const,record,expected_version:null}))]);
        const approvals=[];
        for(const old of claimed.d.approvals){
          if(old.kind==='final'&&old.status==='active'){
            const invalidated=ApprovalSchema.parse({...old,version:old.version+1,status:'invalidated',created_at:at,changes:[...old.changes,{at,author:'local_assembler',reason:'Nova montagem exige revisão integral própria.'}]});
            await media.commitWithin(client,claimed.p.id,[{kind:'approval',record:invalidated,expected_version:old.version}]);approvals.push(invalidated);
          }else approvals.push(old);
        }
        const d=DossierSchema.parse({...claimed.d,version:claimed.d.version+1,created_at:at,timeline:renderedTimeline,assets:[...claimed.d.assets,render,...subtitles.assets],approvals,
          evaluations:[...claimed.d.evaluations,...subtitles.evaluations],
          changes:[...claimed.d.changes,{at,author:'local_assembler',reason:'Montagem local concluída com prévia candidata.'}]});
        await client.query('INSERT INTO production_dossiers(id,version,record) VALUES($1,$2,$3::jsonb)',[d.id,d.version,JSON.stringify(d)]);
        const p=ProductionSchema.parse({...claimed.p,version:claimed.p.version+1,created_at:at,status:'ready_for_review',stage:'review',dossier:{id:d.id,version:d.version},current_render:{id:render.id,version:render.version},current_approval:null,
          changes:[...claimed.p.changes,{at,author:'local_assembler',reason:'Prévia publicada atomicamente; revisão humana pendente.'}]});
        await client.query('INSERT INTO production_revisions(id,version,record) VALUES($1,$2,$3::jsonb)',[p.id,p.version,JSON.stringify(p)]);
        await client.query('UPDATE production_heads SET version=$2 WHERE id=$1',[p.id,p.version]);
        const corrections=(await client.query('SELECT r.record FROM correction_proposal_revisions r JOIN correction_proposal_heads h USING(id,version) WHERE h.production_id=$1',[p.id])).rows;
        for(const row of corrections){const old=CorrectionSchema.parse(row.record);if(old.status!=='running')continue;
          const next=CorrectionSchema.parse({...old,version:old.version+1,created_at:at,status:'completed',changes:[...old.changes,{at,author:'local_assembler',reason:`Nova prévia ${render.id}:v${render.version} publicada; apontamento aguarda revisão própria.`}]});
          await client.query('INSERT INTO correction_proposal_revisions(id,version,record) VALUES($1,$2,$3::jsonb)',[next.id,next.version,JSON.stringify(next)]);
          await client.query('UPDATE correction_proposal_heads SET version=$2 WHERE id=$1',[next.id,next.version]);
        }
        const eventId=randomUUID();await client.query('INSERT INTO production_events(id,production_id,version,record) VALUES($1,$2,$3,$4::jsonb)',[eventId,p.id,p.version,JSON.stringify({id:eventId,production:{id:p.id,version:p.version},at,type:'assembly_completed',message:'Prévia local íntegra disponível para revisão humana.'})]);
        await client.query("UPDATE assembly_runs SET state='completed',result=$2::jsonb WHERE command_id=$1",[request.command_id,JSON.stringify(p)]);
        return p;
      });
    }catch(error){
      await this.db.query("UPDATE assembly_runs SET state='failed',diagnostic='local_assembly_failed' WHERE command_id=$1 AND state='running' AND lease_token=$2",[request.command_id,token]);
      throw error;
    }
  }
  async reconcileInterrupted(){
    const result=await this.db.query("UPDATE assembly_runs SET state='failed',diagnostic='local_assembly_interrupted' WHERE state='running' AND started_at<CURRENT_TIMESTAMP-INTERVAL '3 minutes' RETURNING command_id");
    return result.rowCount??0;
  }
}
