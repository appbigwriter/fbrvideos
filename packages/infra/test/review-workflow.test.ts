import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PGlite} from '@electric-sql/pglite';
import {ReviewViewSchema,DeliveryViewSchema} from '@fbr/contracts';
import {productionFixture,dossierFixture,articleFixture,profileFixture,universeConfigurationFixture} from '@fbr/contracts/fixtures';
import {ConfigurationService,ProductionService,canonical,sha256} from '@fbr/domain';
import {getPipelineCatalog,SimulatedGenerationAdapter} from '@fbr/pipeline';
import {buildApp} from '../../../apps/api/src/app.js';
import {PostgresDatabase,PostgresConfigurationStore,PostgresReviewWorkflow,LocalImmutableAssetStore,LocalAssemblyService,migrateConfiguration,
  PostgresGenerationQueue,PostgresMediaStore,PostgresProductionStore,
  type SqlClient,type SqlDatabase} from '../src/index.js';
let db:SqlDatabase,close:()=>Promise<void>,root:string,files:LocalImmutableAssetStore,workflow:PostgresReviewWorkflow;
before(async()=>{
  if(process.env.TEST_DATABASE_URL){const pg=new PostgresDatabase(process.env.TEST_DATABASE_URL);db=pg;close=()=>pg.close();}
  else{const engine=new PGlite();const wrap=(client:Pick<PGlite,'query'|'exec'>):SqlClient=>({async query(sql,values){
    if(values===undefined){const result=(await client.exec(sql)).at(-1);return{rows:result?.rows as Record<string,unknown>[]??[],rowCount:result?.affectedRows??0};}
    const result=await client.query<Record<string,unknown>>(sql,values);return{rows:result.rows,rowCount:result.affectedRows??0};
  }});db={...wrap(engine),transaction:run=>engine.transaction(tx=>run(wrap(tx)))};close=()=>engine.close();}
  await migrateConfiguration(db);root=await mkdtemp(join(tmpdir(),'fbr-review-test-'));files=new LocalImmutableAssetStore(root);workflow=new PostgresReviewWorkflow(db,files);
});
test('Correção visual estima/autoriza/reserva atomicamente, preserva áudio e sobrevive a replay',async()=>{
  const run=promisify(execFile),image=join(root,`${randomUUID()}.png`),audio=join(root,`${randomUUID()}.wav`);
  await run('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-f','lavfi','-i','color=c=green:s=160x240','-frames:v','1',image],{windowsHide:true});
  await run('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=0.4','-c:a','pcm_s16le',audio],{windowsHide:true});
  const {p,d}=await fixture({image:await readFile(image),audio:await readFile(audio)}),audioAsset=d.assets.find(a=>a.type==='audio')!,visual=d.assets.find(a=>a.type==='image')!;
  await new LocalAssemblyService(db,files).assemble({command_id:randomUUID(),production:{id:p.id,version:1},bindings:{audio:[{speech_segment_id:'speech_01',asset:{id:audioAsset.id,version:1}}],video:[{shot:{id:d.shots[0]!.id,version:1},asset:{id:visual.id,version:1}}]}});
  let view=await workflow.review(p.id);
  const point=await workflow.addPoint({command_id:randomUUID(),production:view.production,render:view.render!.ref,render_hash:view.render!.hash,shot:{id:d.shots[0]!.id,version:1},at_seconds:0.1,category:'image_mismatch',comment:'Teste visual sem gasto externo.'});
  view=await workflow.review(p.id);const correction=await workflow.proposeCorrection({command_id:randomUUID(),production:view.production,point:{id:point.id,version:1}});
  view=await workflow.review(p.id);const current=(await db.query('SELECT record FROM production_revisions WHERE id=$1 AND version=$2',[p.id,view.production.version])).rows[0]!.record as typeof p;
  const body={id:randomUUID(),production:view.production,dossier:current.dossier!,correction:{id:correction.id,version:1},roots:[{id:visual.id,version:1}],intents:[{
    adapter_id:'sim_image',estimate:{currency:p.costs.currency,upper_minor:0,evidence:'Simulação sem cobrança.'},request:{contract_version:'0.1.0',production:view.production,shot:{id:d.shots[0]!.id,version:1},
      execution_key:sha256(randomUUID()),attempt:1,operation:'image',route:'still_image',input_assets:[],references:[],configuration_hash:sha256('correction'),parameters:{prompt:'Cena sintética'},currency:p.costs.currency,reserved_minor:0}}]};
  const plan={...body,hash:sha256(canonical(body))};await workflow.estimateCorrection(plan);assert.deepEqual(await workflow.estimateCorrection(plan),plan);
  view=await workflow.review(p.id);const quoted=view.corrections[0]!;assert.equal(quoted.status,'awaiting_cost_authorization');assert.equal(quoted.costs.estimated_minor,0);
  const authorize={command_id:randomUUID(),production:view.production,correction:{id:quoted.id,version:quoted.version},plan_hash:plan.hash,maximum_minor:0};
  await assert.rejects(workflow.authorizeCorrection({...authorize,plan_hash:'f'.repeat(64)}),/Autorização/);
  const authorized=await workflow.authorizeCorrection(authorize);view=await workflow.review(p.id);
  const execute={command_id:randomUUID(),production:view.production,correction:{id:authorized.id,version:authorized.version},plan_hash:plan.hash};
  const running=await workflow.executeCorrection(execute);assert.equal(running.status,'running');assert.deepEqual(await workflow.executeCorrection(execute),running);
  const jobs=await new PostgresGenerationQueue(db).list(p.id);assert.equal(jobs.length,1);assert.equal(jobs[0]!.state,'prepared');
  const state=(await db.query('SELECT r.record FROM production_revisions r JOIN production_heads h USING(id,version) WHERE h.id=$1',[p.id])).rows[0]!.record as typeof p;
  const next=(await db.query('SELECT record FROM production_dossiers WHERE id=$1 AND version=$2',[state.dossier!.id,state.dossier!.version])).rows[0]!.record as typeof d;
  assert.equal(next.assets.find(a=>a.id===audioAsset.id)!.version,1);assert.equal(next.assets.find(a=>a.id===audioAsset.id)!.status,'approved');
  assert.equal(next.assets.find(a=>a.id===visual.id)!.status,'outdated');assert.equal(state.current_render,null);
  const queue=new PostgresGenerationQueue(db),adapter=new SimulatedGenerationAdapter('image'),accepted=await adapter.submit(jobs[0]!.intent.request);
  assert.equal(accepted.outcome,'accepted');if(accepted.outcome!=='accepted')throw new Error('adapter blocked');
  await adapter.query(accepted.job.external_job_id!);const done=await adapter.query(accepted.job.external_job_id!);
  assert.equal(done.outcome,'accepted');if(done.outcome!=='accepted')throw new Error('adapter blocked');
  const outputId=randomUUID(),evaluationId=randomUUID(),output={...visual,id:outputId,version:1,configuration_hash:jobs[0]!.intent.request.configuration_hash,execution:{id:done.job.id,version:done.job.version},evaluation_refs:[{id:evaluationId,version:1}]};
  const job={...done.job,output_assets:[{id:outputId,version:1}]},claimed=await queue.claim(jobs[0]!.id);
  await queue.complete(jobs[0]!.id,claimed!.lease_token!,job);
  const evaluation={...d.evaluations.find(e=>e.target.id===visual.id)!,id:evaluationId,version:1,target:{id:outputId,version:1}};
  await new PostgresMediaStore(db,files).commit(p.id,[{kind:'asset',record:output,expected_version:null},{kind:'evaluation',record:evaluation,expected_version:null}]);
  view=await workflow.review(p.id);
  const publish={command_id:randomUUID(),production:view.production,correction:{id:running.id,version:running.version},replacements:[{previous:{id:visual.id,version:2},next:{id:outputId,version:1}}]};
  const assembly=await workflow.publishCorrectionAssets(publish);assert.equal(assembly.stage,'assembly');assert.deepEqual(await workflow.publishCorrectionAssets(publish),assembly);
  const rebuilt=await new LocalAssemblyService(db,files).assemble({command_id:randomUUID(),production:{id:p.id,version:assembly.version},bindings:{audio:[{speech_segment_id:'speech_01',asset:{id:audioAsset.id,version:1}}],video:[{shot:{id:d.shots[0]!.id,version:1},asset:{id:outputId,version:1}}]}});
  assert.equal(rebuilt.status,'ready_for_review');view=await workflow.review(p.id);assert.equal(view.corrections[0]!.status,'completed');assert.equal(view.points[0]!.status,'open');
  assert.equal(view.actions.approve.enabled,false);assert.ok(view.render);assert.notEqual(view.render.ref.id,correction.render.id);
});
after(async()=>{await close?.();if(root){assert.ok(root.startsWith(join(tmpdir(),'fbr-review-test-')));await rm(root,{recursive:true,force:true});}});
async function fixture(inputs?:{image:Uint8Array;audio:Uint8Array},planning=false){
  const id=randomUUID(),d=structuredClone(dossierFixture),p=structuredClone(productionFixture);
  d.id=randomUUID();d.production={id,version:1};d.timeline!.id=randomUUID();d.timeline!.production={id,version:1};
  const inputIds=new Map(d.assets.filter(a=>a.type!=='render').map(a=>[a.id,randomUUID()]));
  const remap=(ref:{id:string;version:number})=>({id:inputIds.get(ref.id)??ref.id,version:ref.version});
  for(const asset of d.assets){asset.id=inputIds.get(asset.id)??asset.id;asset.references=asset.references.map(remap);}
  for(const evaluation of d.evaluations)evaluation.target=remap(evaluation.target);
  for(const segment of [...d.timeline!.audio,...d.timeline!.video])segment.asset=remap(segment.asset);
  for(const job of d.jobs){job.production={id,version:1};job.output_assets=job.output_assets.map(remap);}
  const render=d.assets.find(a=>a.type==='render')!;render.id=randomUUID();render.status='candidate';render.specification={id:d.timeline!.id,version:1};render.evaluation_refs=[];
  const bytes=new TextEncoder().encode(`Fixtures binárias sintéticas de revisão ${id}; não são vídeo do piloto.`),hash=createHash('sha256').update(bytes).digest('hex');
  render.file={...render.file,hash,storage_key:`test/${hash}.mp4`,bytes:bytes.length};await files.putImmutable(render.file.storage_key,bytes,hash);
  d.approvals=[];d.evaluations=d.evaluations.filter(e=>e.target.id!=='render_fixture');
  p.id=id;p.dossier={id:d.id,version:1};p.current_render={id:render.id,version:1};p.current_approval=null;
  let snapshot:unknown=null;
  if(planning){p.status='awaiting_decision';p.stage='script_direction';p.current_render=null;
    p.pending_issues=[{code:'audiovisual_gate_pending',message:'Revisão de planejamento pendente.',next_action:'Conferir fontes e direção.',required:true}];
    d.status='specified';d.assets=[];d.jobs=[];d.evaluations=[];d.timeline=null;}
  if(inputs){
    p.status='producing';p.stage='assembly';p.current_render=null;d.timeline=null;d.assets=d.assets.filter(a=>a.type!=='render');
    for(const type of ['image','audio'] as const){
      const asset=d.assets.find(a=>a.type===type)!,bytes=inputs[type],hash=createHash('sha256').update(bytes).digest('hex');
      asset.file={...asset.file,storage_key:`test/${hash}.bin`,hash,bytes:bytes.length,...(type==='audio'?{duration_seconds:0.4}:{width:160,height:240})};
      if(type==='audio')asset.specification={id:d.id,version:1};
      await files.putImmutable(asset.file.storage_key,bytes,hash);
    }
  }
  if(inputs||planning){
    const profile=inputs?{...profileFixture,delivery:{...profileFixture.delivery!,width:160,height:240}}:profileFixture;
    const character={...universeConfigurationFixture.characters[0]!,id:p.character.id};
    const content={production_id:id,captured_at:p.created_at,request:{contract_version:'0.1.0',command_id:randomUUID(),article:p.article,profile:p.profile,name:p.name,mode:p.mode},
      article:articleFixture,profile,character,references:[],bible_original:'Bible sintético de montagem.',catalog:getPipelineCatalog()};
    snapshot={...content,hash:sha256(canonical(content))};
  }
  await db.transaction(async client=>{
    await client.query('INSERT INTO production_heads(id,version) VALUES($1,1)',[id]);
    await client.query('INSERT INTO production_revisions(id,version,record) VALUES($1,1,$2::jsonb)',[id,JSON.stringify(p)]);
    await client.query('INSERT INTO production_dossiers(id,version,record) VALUES($1,1,$2::jsonb)',[d.id,JSON.stringify(d)]);
    if(snapshot)await client.query('INSERT INTO production_snapshots(production_id,record) VALUES($1,$2::jsonb)',[id,JSON.stringify(snapshot)]);
    await client.query("INSERT INTO media_heads(kind,id,production_id,version) VALUES('asset',$1,$2,1)",[render.id,id]);
    await client.query("INSERT INTO media_revisions(kind,id,version,record) VALUES('asset',$1,1,$2::jsonb)",[render.id,JSON.stringify(render)]);
    if(inputs)for(const asset of d.assets){
      await client.query("INSERT INTO media_heads(kind,id,production_id,version) VALUES('asset',$1,$2,1)",[asset.id,id]);
      await client.query("INSERT INTO media_revisions(kind,id,version,record) VALUES('asset',$1,1,$2::jsonb)",[asset.id,JSON.stringify(asset)]);
    }
  });
  return{p,d,render,bytes};
}
test('Apontamentos preservam render/cena/timecode, bloqueiam aprovação e resolução/replay são persistentes',async()=>{
  const {p,render,d}=await fixture();
  const view=ReviewViewSchema.parse(await workflow.review(p.id));assert.equal(view.actions.approve.enabled,true);
  const request={command_id:randomUUID(),production:{id:p.id,version:1},render:{id:render.id,version:1},render_hash:render.file.hash,
    shot:{id:d.shots[0]!.id,version:1},at_seconds:2,category:'image_mismatch',comment:'Apontamento sintético.'};
  const point=await workflow.addPoint(request);assert.deepEqual(await workflow.addPoint(request),point);
  const changed=await workflow.review(p.id);assert.equal(changed.production.version,2);assert.equal(changed.points.length,1);assert.equal(changed.actions.approve.enabled,false);
  await assert.rejects(workflow.addPoint({...request,comment:'Outra intenção'}),/outra intenção/);
  await assert.rejects(workflow.approve({command_id:randomUUID(),production:changed.production,render:request.render,render_hash:request.render_hash,reviewed_in_full:true}),/pendências/);
  await assert.rejects(workflow.resolvePoint({command_id:randomUUID(),production:changed.production,point:{id:point.id,version:1},status:'addressed',reason:'Teste'}),/nova revisão/);
  const resolution={command_id:randomUUID(),production:changed.production,point:{id:point.id,version:1},status:'dismissed',reason:'Decisão humana sintética no teste.'};
  const resolved=await workflow.resolvePoint(resolution);assert.equal(resolved.version,2);assert.deepEqual(await workflow.resolvePoint(resolution),resolved);
  assert.equal((await workflow.review(p.id)).actions.approve.enabled,true);
  await assert.rejects(db.query('UPDATE review_point_revisions SET record=record WHERE id=$1',[point.id]),/Immutable/);
});
test('Revisão editorial exata não autoriza fornecedor e edição de fala invalida o aceite anterior',async()=>{
  const {p,d}=await fixture(undefined,true),request={command_id:randomUUID(),production:{id:p.id,version:1},dossier:{id:d.id,version:1},reviewed_sources:true,reviewed_direction:true};
  await assert.rejects(workflow.approvePlanning({...request,reviewed_sources:false}));
  const approved=await workflow.approvePlanning(request);assert.equal(approved.status,'awaiting_decision');assert.deepEqual(await workflow.approvePlanning(request),approved);
  assert.ok(approved.pending_issues.some(issue=>issue.code==='provider_setup_pending'));assert.equal((await new PostgresGenerationQueue(db).list(p.id)).length,0);
  const editor=await workflow.speechEditView(p.id);assert.equal(editor.enabled,true);
  const changed=await workflow.editSpeech({command_id:randomUUID(),production:editor.production,dossier:editor.dossier,speech_id:'speech_01',text:'Texto sintético revisado antes de gerar.',reason:'Teste do roteiro.',source_reviewed:true});
  assert.equal(changed.status,'awaiting_decision');assert.equal(changed.stage,'script_direction');
  const newer=(await db.query('SELECT record FROM production_dossiers WHERE id=$1 AND version=$2',[changed.dossier!.id,changed.dossier!.version])).rows[0]!.record as typeof d;
  assert.equal(newer.assets.length,0);assert.ok(newer.approvals.every(approval=>approval.status==='invalidated'));
  await assert.rejects(workflow.beginGeneration({command_id:randomUUID(),production:{id:p.id,version:changed.version},dossier:changed.dossier}),/planejamento aprovado/);
  const reviewed=await workflow.approvePlanning({...request,command_id:randomUUID(),production:{id:p.id,version:changed.version},dossier:changed.dossier});
  const started=await workflow.beginGeneration({command_id:randomUUID(),production:{id:p.id,version:reviewed.version},dossier:reviewed.dossier});assert.equal(started.status,'producing');
});
test('Pausa e retomada em revisão restauram a fase anterior sem reiniciar planejamento',async()=>{
  const {p}=await fixture(),service=new ProductionService(new PostgresProductionStore(db),getPipelineCatalog());
  const paused=await service.command({command_id:randomUUID(),production:{id:p.id,version:1},action:'pause'});assert.equal(paused.status,'paused');
  const resumed=await service.command({command_id:randomUUID(),production:{id:p.id,version:paused.version},action:'resume'});
  assert.equal(resumed.status,'ready_for_review');assert.equal(resumed.stage,'review');assert.deepEqual(resumed.current_render,p.current_render);
  const cancelled=await service.command({command_id:randomUUID(),production:{id:p.id,version:resumed.version},action:'cancel'});assert.equal(cancelled.status,'cancelled');
});
test('Job ativo de custo zero no journal impede aprovação mesmo ausente do dossiê',async()=>{
  const {p,render}=await fixture(),id=randomUUID(),key=sha256(randomUUID());
  const execution={id,version:1,state:'prepared',reserved_minor:0,confirmed_minor:0,provider_job:null,diagnostic:null,lease_token:null,lease_until:null,
    intent:{adapter_id:'sim_audio',estimate:{currency:p.costs.currency,upper_minor:0,evidence:'Simulação sem cobrança.'},request:{contract_version:'0.1.0',execution_key:key,attempt:1,
      production:{id:p.id,version:1},shot:null,operation:'audio',route:null,input_assets:[],references:[],configuration_hash:sha256('zero-cost'),parameters:{text:'Sintético'},currency:p.costs.currency,reserved_minor:0}}};
  await db.query('INSERT INTO generation_heads(id,production_id,execution_key,attempt,fingerprint,version) VALUES($1,$2,$3,1,$4,1)',[id,p.id,key,sha256(canonical(execution.intent))]);
  await db.query('INSERT INTO generation_revisions(id,version,record) VALUES($1,1,$2::jsonb)',[id,JSON.stringify(execution)]);
  assert.equal((await workflow.review(p.id)).actions.approve.enabled,false);
  await assert.rejects(workflow.approve({command_id:randomUUID(),production:{id:p.id,version:1},render:{id:render.id,version:1},render_hash:render.file.hash,reviewed_in_full:true}),/custos reconciliados/);
});
test('Aprovação exige declaração integral, hash/revisão exatos e export mantém bytes/revisões imutáveis',async()=>{
  const {p,render,bytes}=await fixture();
  const request={command_id:randomUUID(),production:{id:p.id,version:1},render:{id:render.id,version:1},render_hash:render.file.hash,reviewed_in_full:true};
  await assert.rejects(workflow.approve({...request,reviewed_in_full:false}));
  await assert.rejects(workflow.approve({...request,render_hash:'f'.repeat(64)}),/render exato/);
  const approved=await workflow.approve(request);assert.equal(approved.status,'approved');assert.equal(approved.current_render!.version,2);
  assert.deepEqual(await workflow.approve(request),approved);
  assert.deepEqual(Buffer.from((await workflow.asset(p.id,approved.current_render!)).bytes),Buffer.from(bytes));
  const delivery=DeliveryViewSchema.parse(await workflow.delivery(p.id));assert.equal(delivery.kind,'approved_delivery');
  const exported=await workflow.export({command_id:randomUUID(),production:delivery.production,render:approved.current_render,render_hash:render.file.hash});
  assert.equal(exported.status,'exported');
  const packaged=await workflow.delivery(p.id),manifest=packaged.files.find(file=>file.label==='Manifesto')!;assert.ok(manifest);
  const record=JSON.parse(new TextDecoder().decode(await workflow.manifest(p.id,manifest.ref.id)));
  assert.equal(record.approval.target.version,2);assert.equal(record.status,'approved_delivery');
  const historical=(await db.query('SELECT record FROM production_revisions WHERE id=$1 AND version=1',[p.id])).rows[0]!.record as typeof p;
  assert.equal(historical.status,'ready_for_review');assert.equal(historical.current_approval,null);
  const history=await workflow.history(p.id);assert.equal(history.items.length,2);assert.equal(history.items.filter(item=>item.current).length,1);
  assert.deepEqual(Buffer.from((await workflow.historicalAsset(p.id,1)).bytes),Buffer.from(bytes));
  const another=await fixture();await assert.rejects(workflow.historicalAsset(another.p.id,999),/histórico/);
  await assert.rejects(db.query('UPDATE delivery_manifests SET hash=hash WHERE production_id=$1',[p.id]),/Immutable/);
});
test('HTTP protege ownership e ranges, não expõe storage e recusa comentário em trecho inexistente',async()=>{
  const a=await fixture(),b=await fixture();const app=buildApp(new ConfigurationService(new PostgresConfigurationStore(db)),{review:workflow});
  try{
    const base=`/api/productions/${a.p.id}`;
    const view=(await app.inject({method:'GET',url:`${base}/review`,headers:{host:'localhost'}}));assert.equal(view.statusCode,200);assert.equal(view.body.includes('storage_key'),false);
    const asset=`${base}/assets/${a.render.id}?version=1`;
    const partial=await app.inject({method:'GET',url:asset,headers:{host:'localhost',range:'bytes=0-9'}});
    assert.equal(partial.statusCode,206);assert.equal(partial.rawPayload.length,10);assert.equal(partial.headers['x-content-type-options'],'nosniff');
    assert.equal((await app.inject({method:'GET',url:asset,headers:{host:'localhost',range:'bytes=999999-'}})).statusCode,416);
    assert.equal((await app.inject({method:'GET',url:`/api/productions/${b.p.id}/assets/${a.render.id}?version=1`,headers:{host:'localhost'}})).statusCode,404);
    const point={command_id:randomUUID(),production:{id:a.p.id,version:1},render:{id:a.render.id,version:1},render_hash:a.render.file.hash,
      shot:null,at_seconds:99,category:'comment',comment:'Fora do vídeo'};
    assert.equal((await app.inject({method:'POST',url:`${base}/review/points`,headers:{host:'localhost'},payload:point})).statusCode,400);
    assert.equal((await app.inject({method:'POST',url:`${base}/review/points`,headers:{host:'localhost'},payload:{...point,production:{id:b.p.id,version:1},at_seconds:1}})).statusCode,400);
  }finally{await app.close();}
});
test('Plano visual calcula impacto sem gasto/invalidação prematura e cancelamento libera a decisão',async()=>{
  const {p,render,d}=await fixture();
  const point=await workflow.addPoint({command_id:randomUUID(),production:{id:p.id,version:1},render:{id:render.id,version:1},render_hash:render.file.hash,
    shot:{id:d.shots[0]!.id,version:1},at_seconds:2,category:'image_mismatch',comment:'Corrigir composição sintética.'});
  let view=await workflow.review(p.id);
  const request={command_id:randomUUID(),production:view.production,point:{id:point.id,version:1}};
  const proposal=await workflow.proposeCorrection(request);assert.deepEqual(await workflow.proposeCorrection(request),proposal);
  assert.equal(proposal.costs.estimated_minor,null);assert.equal(proposal.additional_cost_authorized,false);
  assert.ok(proposal.impact.preserved.some(ref=>ref.id===d.assets.find(a=>a.type==='audio')!.id));
  assert.ok(proposal.impact.invalidated.some(ref=>ref.id===render.id));
  view=await workflow.review(p.id);assert.ok(view.render);assert.equal(view.corrections.length,1);assert.equal(view.actions.approve.enabled,false);
  const cancelled=await workflow.cancelCorrection({command_id:randomUUID(),production:view.production,correction:{id:proposal.id,version:1},reason:'Cancelamento humano sintético.'});
  assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.version,2);
  view=await workflow.review(p.id);
  await workflow.resolvePoint({command_id:randomUUID(),production:view.production,point:{id:point.id,version:1},status:'dismissed',reason:'Decisão independente no teste.'});
  assert.equal((await workflow.review(p.id)).actions.approve.enabled,true);
  await assert.rejects(db.query('UPDATE correction_proposal_revisions SET record=record WHERE id=$1',[proposal.id]),/Immutable/);
});
test('Montagem real sintética publica prévia/revisão juntas e replay não duplica render nem eventos',async t=>{
  const run=promisify(execFile);
  try{await run('ffmpeg',['-version'],{windowsHide:true});await run('ffprobe',['-version'],{windowsHide:true});}catch{t.skip('FFmpeg/ffprobe indisponíveis.');return;}
  const image=join(root,`${randomUUID()}.png`),audio=join(root,`${randomUUID()}.wav`);
  await run('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-f','lavfi','-i','color=c=blue:s=160x240','-frames:v','1',image],{windowsHide:true});
  await run('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=0.4','-c:a','pcm_s16le',audio],{windowsHide:true});
  const {p,d}=await fixture({image:await readFile(image),audio:await readFile(audio)});
  const service=new LocalAssemblyService(db,files),request={command_id:randomUUID(),production:{id:p.id,version:1},bindings:{
    audio:[{speech_segment_id:'speech_01',asset:{id:d.assets.find(a=>a.type==='audio')!.id,version:1}}],video:[{shot:{id:d.shots[0]!.id,version:1},asset:{id:d.assets.find(a=>a.type==='image')!.id,version:1}}]}};
  const published=await service.assemble(request);assert.equal(published.status,'ready_for_review');assert.equal(published.version,2);
  assert.deepEqual(await service.assemble(request),published);
  const view=await workflow.review(p.id);assert.ok(view.render);assert.ok(view.render.duration_seconds<1);assert.equal(view.scenes.length,1);
  const delivery=await workflow.delivery(p.id),subtitles=delivery.files.filter(file=>file.label.startsWith('Legendas'));
  assert.equal(subtitles.length,2);
  for(const subtitle of subtitles){
    const file=await workflow.asset(p.id,subtitle.ref),text=new TextDecoder().decode(file.bytes);
    assert.ok(text.includes('00:00:00'));assert.ok(text.includes('-->'));
    assert.ok(['text/vtt','application/x-subrip'].includes(file.mime_type));
  }
  const approved=await workflow.approve({command_id:randomUUID(),production:view.production,render:view.render.ref,render_hash:view.render.hash,reviewed_in_full:true});
  await workflow.export({command_id:randomUUID(),production:{id:p.id,version:approved.version},render:approved.current_render,render_hash:view.render.hash});
  const final=await workflow.delivery(p.id),manifest=final.files.find(file=>file.label==='Manifesto')!;
  const bundle=JSON.parse(new TextDecoder().decode(await workflow.manifest(p.id,manifest.ref.id)));
  assert.equal(bundle.assets.filter((asset:{type:string})=>asset.type==='subtitle').length,2);
  assert.equal(Number((await db.query("SELECT count(*) AS count FROM production_events WHERE production_id=$1 AND record->>'type'='assembly_completed'",[p.id])).rows[0]!.count),1);
  assert.equal((await db.query('SELECT record FROM media_revisions WHERE kind=$1 AND id=$2 AND version=1',['asset',published.current_render!.id])).rows.length,1);
  await assert.rejects(service.assemble({...request,bindings:{...request.bindings,audio:[]}}));
  const editing=await workflow.speechEditView(p.id),edit={command_id:randomUUID(),production:editing.production,dossier:editing.dossier,
    speech_id:'speech_01',text:'Texto sintético alterado para verificar invalidação.',reason:'Teste de edição e histórico.',source_reviewed:true};
  await assert.rejects(workflow.editSpeech({...edit,source_reviewed:false}));
  const changed=await workflow.editSpeech(edit);assert.equal(changed.status,'correcting');assert.equal(changed.current_approval,null);assert.equal(changed.current_render,null);
  assert.deepEqual(await workflow.editSpeech(edit),changed);
  assert.equal((await workflow.delivery(p.id)).kind,'unavailable');assert.ok((await workflow.history(p.id)).items.length>=2);
  const after=(await db.query('SELECT record FROM production_dossiers WHERE id=$1 AND version=$2',[changed.dossier!.id,changed.dossier!.version])).rows[0]!.record as typeof d;
  assert.ok(after.assets.every(asset=>asset.status==='outdated'));assert.equal(after.timeline!.status,'outdated');
  assert.ok(after.approvals.every(approval=>approval.status==='invalidated'));
});
