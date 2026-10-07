import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {ConfigurationService,ProductionService} from '@fbr/domain';
import {getPipelineCatalog,AutomaticPlanner,GenerationWorker} from '@fbr/pipeline';
import {ProductionSchema,ProductionDetailSchema,AssetSchema,type Production} from '@fbr/contracts';
import {buildApp} from '../../../apps/api/src/app.js';
import {migrateConfiguration,LocalImmutableAssetStore,PostgresConfigurationStore,PostgresProductionStore,PostgresReviewWorkflow,PostgresGenerationQueue,createProviderRuntime,
  type SqlClient,type SqlDatabase} from '../src/index.js';

test('Jornada pública inicial, aprovação de candidatos, correção visual/fala, reinício e exportação sintética',async()=>{
  const engine=new PGlite(),root=await mkdtemp(join(tmpdir(),'fbr-pipeline-test-'));
  const wrap=(client:Pick<PGlite,'query'|'exec'>):SqlClient=>({async query(sql,values){if(values===undefined){const r=(await client.exec(sql)).at(-1);return{rows:r?.rows as Record<string,unknown>[]??[],rowCount:r?.affectedRows??0};}const r=await client.query<Record<string,unknown>>(sql,values);return{rows:r.rows,rowCount:r.affectedRows??0};}});
  const db:SqlDatabase={...wrap(engine),transaction:run=>engine.transaction(tx=>run(wrap(tx)))},files=new LocalImmutableAssetStore(root);
  const previousMode=process.env.FBR_GENERATION_MODE;process.env.FBR_GENERATION_MODE='synthetic';
  try{
    await migrateConfiguration(db);
    let runtime=await createProviderRuntime({db,files});
    const configurations=new ConfigurationService(new PostgresConfigurationStore(db)),productions=new ProductionService(new PostgresProductionStore(db),getPipelineCatalog()),planner=new AutomaticPlanner(productions),review=new PostgresReviewWorkflow(db,files);
    let app=buildApp(configurations,{productions,planner,review,pipeline:runtime.pipeline!,generation:new PostgresGenerationQueue(db),prepareCorrection:id=>runtime.pipeline!.prepareCorrection(id)});
    const call=async(path:string,payload?:unknown,status=200)=>{const response=await app.inject({method:payload===undefined?'GET':'POST',url:`/api${path}`,headers:{host:'localhost',...(payload===undefined?{}:{'content-type':'application/json'})},...(payload===undefined?{}:{payload:JSON.stringify(payload)})});assert.equal(response.statusCode,status,`${path}: ${response.body}`);return response.json() as unknown;};
    const command=(data:unknown)=>({command_id:randomUUID(),expected_version:null,reason:'Ensaio sintético isolado.',data});
    const character=await call('/characters',command({name:'Personagem sintética de teste',status:'confirmed',bible_original:'Bible sintético de ensaio, sem experiência real.',interpretation:'Somente teste técnico.',interpretation_confirmed:true,references:[],voice:null,authorized_variations:[]}),201) as {id:string;version:number};
    const article=await call('/articles',command({title:'Artigo sintético',source_author:'Autora de ensaio',content:'Organizar notificações reduz interrupções.',complete:true,character:{id:character.id,version:1}}),201) as {id:string;version:number};
    const voice=await call('/references',command({status:'pending',kind:'voice',name:'Referência de ensaio sintético',asset_refs:[],rules:['Tom sintético, sem voz real.'],usage_permission:'allowed'}),201) as {id:string;version:number};
    const profile=await call('/profiles',command({name:'Perfil sintético',status:'calibrating',character:{id:character.id,version:1},language:'pt-BR',target_seconds:4.8,recipe:'explanation',permitted_shot_classes:['editorial_illustration'],permitted_references:[{id:voice.id,version:1}],voice:{id:voice.id,version:1},delivery:{width:160,height:240,fps:30,video_codec:'h264',audio_codec:'aac',audio_sample_rate:48000,subtitle_format:'srt'},budget:{currency:'BRL',ceiling_minor:10000,safety_margin_minor:1000,max_attempts_per_job:2},calibration_scope:null}),201) as {id:string;version:number};
    const created=ProductionSchema.parse(await call('/productions',{contract_version:'0.1.0',command_id:randomUUID(),article:{id:article.id,version:1},profile:{id:profile.id,version:1},name:'Jornada de ensaio sem gasto',mode:'calibration'},201));
    const detail=()=>call(`/productions/${created.id}`).then(ProductionDetailSchema.parse);
    let state=await detail();assert.equal(state.production.status,'awaiting_decision');assert.ok(state.dossier);
    await call(`/productions/${created.id}/planning/approve`,{command_id:randomUUID(),production:{id:created.id,version:state.production.version},dossier:{id:state.dossier!.id,version:state.dossier!.version},reviewed_sources:true,reviewed_direction:true});state=await detail();
    const start={command_id:randomUUID(),production:{id:created.id,version:state.production.version},dossier:state.production.dossier};
    await call(`/productions/${created.id}/generation/start`,start);await call(`/productions/${created.id}/generation/start`,start);
    async function cycle(){
      const queue=new PostgresGenerationQueue(db),worker=new GenerationWorker(queue,runtime.adapters);
      for(const job of await queue.list(created.id))if(!['succeeded','failed','cancelled'].includes(job.state)&&await runtime.pipeline!.canExecute(job))await worker.run(job.id);
      await runtime.pipeline!.advance(created.id);
      const candidates=await call(`/productions/${created.id}/candidates`) as {items:unknown[]};
      for(const item of candidates.items){const {preview_url:_url,...record}=item as Record<string,unknown>;const asset=AssetSchema.parse(record);if(asset.status!=='candidate')continue;
        const media=await app.inject({url:`/api/productions/${created.id}/candidates/${asset.id}?version=${asset.version}`,headers:{host:'localhost',range:'bytes=0-11'}});assert.equal(media.statusCode,206);
        const current=await detail();await call(`/productions/${created.id}/candidates/evaluate`,{command_id:randomUUID(),production:{id:created.id,version:current.production.version},asset:{id:asset.id,version:asset.version},hash:asset.file.hash,decision:'approved',reviewed_in_full:true,rights_confirmed:true,reason:'Aprovação sintética explícita no teste, sem aceite de piloto.'});
      }
    }
    for(let i=0;i<8&&(await detail()).production.status!=='ready_for_review';i++)await cycle();
    state=await detail();assert.equal(state.production.status,'ready_for_review');assert.equal(state.production.costs.confirmed_minor,0);
    // Recria runtime/API; recibos locais e outputs não dependem de objetos em memória.
    await app.close();runtime=await createProviderRuntime({db,files});app=buildApp(configurations,{productions,planner,review,pipeline:runtime.pipeline!,generation:new PostgresGenerationQueue(db),prepareCorrection:id=>runtime.pipeline!.prepareCorrection(id)});
    const view=await review.review(created.id),shot=view.scenes[0]!;
    const point=await call(`/productions/${created.id}/review/points`,{command_id:randomUUID(),production:view.production,render:view.render!.ref,render_hash:view.render!.hash,shot:shot.ref,at_seconds:0.1,category:'image_mismatch',comment:'Refazer imagem sintética.'}) as {id:string;version:number};
    state=await detail();await call(`/productions/${created.id}/review/corrections`,{command_id:randomUUID(),production:{id:created.id,version:state.production.version},point:{id:point.id,version:point.version}});
    await runtime.pipeline!.prepareCorrection(created.id);
    let correctionView=await review.review(created.id),correction=correctionView.corrections[0]!;
    const plan=(await db.query('SELECT record FROM correction_execution_plans WHERE correction_id=$1',[correction.id])).rows[0]!.record as {hash:string};
    const authorized=await call(`/productions/${created.id}/review/corrections/authorize`,{command_id:randomUUID(),production:correctionView.production,correction:{id:correction.id,version:correction.version},plan_hash:plan.hash,maximum_minor:0}) as {id:string;version:number};
    correctionView=await review.review(created.id);await call(`/productions/${created.id}/review/corrections/execute`,{command_id:randomUUID(),production:correctionView.production,correction:{id:authorized.id,version:authorized.version},plan_hash:plan.hash});
    for(let i=0;i<8&&(await detail()).production.status!=='ready_for_review';i++)await cycle();assert.equal((await detail()).production.status,'ready_for_review');
    correctionView=await review.review(created.id);await call(`/productions/${created.id}/review/resolve`,{command_id:randomUUID(),production:correctionView.production,point:{id:point.id,version:1},status:'addressed',reason:'Nova prévia sintética conferida.'});
    // Mudança narrativa deve refazer também as imagens invalidadas na revisão anterior.
    state=await detail();const speech=state.dossier!.blocks.flatMap(b=>b.speeches).find(s=>s.kind==='afirmacao_factual')!;
    await call(`/productions/${created.id}/review/speeches`,{command_id:randomUUID(),production:{id:created.id,version:state.production.version},dossier:state.production.dossier,speech_id:speech.id,text:'Organizar as notificações reduz interrupções.',reason:'Ensaio da correção narrativa.',source_reviewed:true});
    await runtime.pipeline!.prepareCorrection(created.id);correctionView=await review.review(created.id);correction=correctionView.corrections.find(c=>c.status==='awaiting_cost_authorization')!;assert.ok(correction);
    const speechPlan=(await db.query('SELECT record FROM correction_execution_plans WHERE correction_id=$1',[correction.id])).rows[0]!.record as {hash:string;intents:unknown[]};assert.ok(speechPlan.intents.length>=3);
    const auth=await call(`/productions/${created.id}/review/corrections/authorize`,{command_id:randomUUID(),production:correctionView.production,correction:{id:correction.id,version:correction.version},plan_hash:speechPlan.hash,maximum_minor:0}) as {id:string;version:number};
    correctionView=await review.review(created.id);const speechExecute={command_id:randomUUID(),production:correctionView.production,correction:{id:auth.id,version:auth.version},plan_hash:speechPlan.hash};await call(`/productions/${created.id}/review/corrections/execute`,speechExecute);
    for(let i=0;i<8&&(await detail()).production.status!=='ready_for_review';i++)await cycle();state=await detail();assert.equal(state.production.status,'ready_for_review');
    const final=await review.review(created.id);await call(`/productions/${created.id}/review/approve`,{command_id:randomUUID(),production:final.production,render:final.render!.ref,render_hash:final.render!.hash,reviewed_in_full:true});
    state=await detail();const approvedView=await review.review(created.id);await call(`/productions/${created.id}/delivery/export`,{command_id:randomUUID(),production:{id:created.id,version:state.production.version},render:approvedView.render!.ref,render_hash:approvedView.render!.hash});
    const delivery=await review.delivery(created.id);assert.equal(delivery.kind,'approved_delivery');assert.equal(delivery.files.length,4);
    for(const file of delivery.files){const response=await app.inject({url:file.download_url,headers:{host:'localhost'}});assert.equal(response.statusCode,200);assert.ok(response.rawPayload.length);}
    state=await detail();assert.equal(state.events.length,state.production.version);await app.close();
  }finally{if(previousMode===undefined)delete process.env.FBR_GENERATION_MODE;else process.env.FBR_GENERATION_MODE=previousMode;await engine.close();await rm(root,{recursive:true,force:true});}
});
