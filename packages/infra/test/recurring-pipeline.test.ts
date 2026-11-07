import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ProfileSchema,ProductionSchema,ProductionSnapshotSchema,EvaluationSchema,type Profile,type Article,type Character,type Reference} from '@fbr/contracts';
import {buildApp} from '../../../apps/api/src/app.js';
import {ConfigurationService,ProductionService,canonical,sha256,recurringExecutionPolicy} from '@fbr/domain';
import {AutomaticPlanner,getPipelineCatalog,GenerationWorker} from '@fbr/pipeline';
import {PostgresConfigurationStore,PostgresProductionStore,PostgresGenerationQueue,PostgresReviewWorkflow,LocalImmutableAssetStore,SyntheticMediaAdapter,
  createRuntimeFromBindings,migrateConfiguration,captureFullBackup,restoreFullBackup,assessmentDecision,CalibrationService,type SqlClient,type SqlDatabase,type PipelineBindings,type CandidateAssessor} from '../src/index.js';

async function fixture(run:(input:{db:SqlDatabase;files:LocalImmutableAssetStore;root:string;service:ConfigurationService})=>Promise<void>){
 const engine=new PGlite(),root=await mkdtemp(join(tmpdir(),'fbr-recurring-'));
 const wrap=(client:Pick<PGlite,'query'|'exec'>):SqlClient=>({async query(sql,values){if(values===undefined){const result=(await client.exec(sql)).at(-1);return{rows:result?.rows as Record<string,unknown>[]??[],rowCount:result?.affectedRows??0};}const result=await client.query<Record<string,unknown>>(sql,values);return{rows:result.rows,rowCount:result.affectedRows??0};}});
 const db:SqlDatabase={...wrap(engine),transaction:run=>engine.transaction(tx=>run(wrap(tx)))};
 try{await migrateConfiguration(db);await run({db,files:new LocalImmutableAssetStore(root),root,service:new ConfigurationService(new PostgresConfigurationStore(db))});}
 finally{await engine.close();await rm(root,{recursive:true,force:true});}
}
const command=(data:unknown)=>({command_id:randomUUID(),expected_version:null,reason:'Fixture sintética isolada, sem aceite real.',data});
async function configure(service:ConfigurationService,db:SqlDatabase){
 const character=await service.save('characters',command({name:'Personagem de ensaio',status:'confirmed',bible_original:'Bible apenas sintético de teste.',interpretation:'Ensaio técnico.',interpretation_confirmed:true,references:[],voice:null,authorized_variations:[]})) as Character;
 const article=await service.save('articles',command({title:'Notificações',source_author:'Autora sintética',content:'Organizar notificações reduz interrupções.',complete:true,character:{id:character.id,version:1}})) as Article;
 const voice=await service.save('references',command({name:'Voz sintética',kind:'voice',status:'pending',asset_refs:[],rules:[],usage_permission:'allowed'})) as Reference;
 const draft=await service.save('profiles',command({name:'Perfil de ensaio',status:'calibrating',character:{id:character.id,version:1},language:'pt-BR',target_seconds:4.8,recipe:'explanation',
  permitted_shot_classes:['editorial_illustration'],permitted_references:[{id:voice.id,version:1}],voice:{id:voice.id,version:1},delivery:{width:160,height:240,fps:30,video_codec:'h264',audio_codec:'aac',audio_sample_rate:48000,subtitle_format:'srt'},budget:{currency:'BRL',ceiling_minor:1000,safety_margin_minor:100,max_attempts_per_job:2},calibration_scope:null,
  execution_policy:{id:'test_policy',version:1,planning:'automatic',candidate_review:'operational',allowed_operations:['audio','image'],allowed_shot_classes:['editorial_illustration'],required_checks:['semantic_fit'],evidence_refs:['test_only'],max_auto_retries:1}})) as Profile;
 // Test-only catalog evidence exercises the pre-existing trusted-catalog admission path, never real calibration.
 const profile=ProfileSchema.parse({...draft,version:2,status:'validated',calibration_scope:{article_classes:['explanation'],formats:['160x240@30'],evidence_refs:['test_only']}});
 await db.query("INSERT INTO configuration_revisions(kind,id,version,record) VALUES('profiles',$1,2,$2::jsonb)",[profile.id,JSON.stringify(profile)]); await db.query("UPDATE configuration_heads SET version=2 WHERE kind='profiles' AND id=$1",[profile.id]);
 const catalog=getPipelineCatalog();catalog.calibrations.push({profile:{id:profile.id,version:profile.version},recipe:'explanation',recipe_version:1,model_operation:'test_only',shot_classes:['editorial_illustration'],article_classes:['explanation'],formats:['160x240@30'],evidence_refs:['test_only']});
 return{character,article,profile,catalog};
}

test('Recurring policy requires complete evidenced checks and never infers rights or missing quality',()=>{
 const check={name:'semantic_fit',mandatory:false,result:'pass' as const,evidence:'Evidência sintética de ensaio.',timecode_seconds:null,corrective_action:null};
 assert.equal(assessmentDecision({criteria:[check],retryable:false},['semantic_fit'],true),'approved');
 assert.equal(assessmentDecision({criteria:[check],retryable:false},['identity'],true),'needs_review');
 assert.equal(assessmentDecision({criteria:[check],retryable:false},['semantic_fit'],false),'needs_review');
 assert.equal(assessmentDecision({criteria:[check,check],retryable:false},['semantic_fit'],true),'needs_review');
 assert.equal(assessmentDecision({criteria:[{...check,result:'not_applicable'}],retryable:false},['semantic_fit'],true),'needs_review');
 assert.equal(assessmentDecision({criteria:[{...check,result:'fail'}],retryable:true},['semantic_fit'],true),'rejected');
});

test('Recurring public policy advances without human candidate approvals, retries once, survives recovery and preserves final consent',async()=>fixture(async({db,files,root,service})=>{
 const {profile,article,catalog}=await configure(service,db),productions=new ProductionService(new PostgresProductionStore(db),catalog),planner=new AutomaticPlanner(productions);
 const bindings:PipelineBindings={};let rejectedImage=false;
 const assessor:CandidateAssessor={id:'test_assessor',version:'1',async evaluate({asset,execution}){
  const reject=asset.type==='image'&&!rejectedImage;if(reject)rejectedImage=true;
  return{retryable:reject,criteria:[{name:'semantic_fit',mandatory:true,result:reject?'fail':'pass',evidence:`Somente ensaio sintético ${execution.id}; não é avaliação real.`,timecode_seconds:null,corrective_action:reject?'Gerar alternativa sintética.':null}]};
 }};
 for(const operation of ['audio','image'] as const){const adapter=new SyntheticMediaAdapter(db,files,operation);bindings[operation]={adapter,outputs:adapter,assessor,estimate:async()=>({currency:'BRL',upper_minor:0,evidence:'Ensaio local.'})};}
 let runtime=await createRuntimeFromBindings({db,files},bindings,{admission:async()=>false,admitReal:async()=>false});
 const app=buildApp(service,{productions,planner,review:new PostgresReviewWorkflow(db,files),pipeline:runtime.pipeline!,generation:new PostgresGenerationQueue(db)});
 const response=await app.inject({method:'POST',url:'/api/productions',headers:{host:'localhost'},payload:{contract_version:'0.1.0',command_id:randomUUID(),article:{id:article.id,version:1},profile:{id:profile.id,version:profile.version},name:'Recorrência de ensaio',mode:'recurring'}});
 assert.equal(response.statusCode,201,response.body);const created=ProductionSchema.parse(response.json());await planner.waitForIdle();
 let state=await productions.detail(created.id);assert.equal(state.production.status,'awaiting_decision');
 assert.ok(recurringExecutionPolicy(state.snapshot));
 assert.equal(recurringExecutionPolicy({...state.snapshot,profile:{...state.snapshot.profile,status:'calibrating'}}),null);
 const eligibility=await app.inject({url:`/api/productions/${created.id}/generation/status`,headers:{host:'localhost'}});assert.equal(eligibility.json().operational_eligible,true);
 await runtime.recover!();assert.equal((await productions.detail(created.id)).production.status,'producing');
 const queue=new PostgresGenerationQueue(db);
 for(let cycle=0;cycle<12;cycle++){
  const worker=new GenerationWorker(queue,runtime.adapters);
  for(const job of await queue.list(created.id))if(!['succeeded','failed','cancelled'].includes(job.state)&&await runtime.canExecute!(job))await worker.run(job.id);
  await runtime.recover!();state=await productions.detail(created.id);
  if(state.production.status==='ready_for_review')break;
  if(cycle===1)runtime=await createRuntimeFromBindings({db,files},bindings,{admission:async()=>false,admitReal:async()=>false});
 }
 assert.equal(state.production.status,'ready_for_review');assert.equal(state.production.current_approval,null);
 assert.ok(state.dossier!.evaluations.some(e=>e.method==='operational_policy'));assert.equal(state.dossier!.approvals.length,0);
 const candidates=await app.inject({url:`/api/productions/${created.id}/candidates`,headers:{host:'localhost'}});assert.equal(candidates.statusCode,200);assert.ok(candidates.json().reviews.some((review:{method:string})=>review.method==='operational_policy'));
 const jobs=await queue.list(created.id);assert.equal(jobs.filter(j=>j.intent.request.operation==='image').length,2);assert.equal(new Set(jobs.map(j=>`${j.intent.request.execution_key}:${j.intent.request.attempt}`)).size,jobs.length);
 const review=new PostgresReviewWorkflow(db,files);assert.notEqual((await review.delivery(created.id)).kind,'approved_delivery');
 const before=canonical(state);await runtime.recover!();assert.equal(canonical(await productions.detail(created.id)),before);
 const backupFiles=new LocalImmutableAssetStore(join(root,'backup')),backup=await captureFullBackup(db,files,backupFiles);
 await fixture(async({db:restored,files:target})=>{await restoreFullBackup(restored,backupFiles,target,backup.metadata_key,backup.metadata_hash);
  const recovered=await new ProductionService(new PostgresProductionStore(restored),catalog).detail(created.id);assert.equal(canonical(recovered),before);assert.ok(ProductionSnapshotSchema.parse(recovered.snapshot).profile.execution_policy);});await app.close();
}));

test('Calibration activation refuses missing/synthetic evidence and generic edits cannot inject validation proof',async()=>fixture(async({db,service})=>{
 const {profile}=await configure(service,db);const calibration=new CalibrationService(db);
 await assert.rejects(calibration.activate({command_id:randomUUID(),decision_id:'missing',profile:{id:profile.id,version:profile.version},confirm_activation:true}));
 const {id,version,created_at,author,changes,...data}=profile;
 await assert.rejects(service.save('profiles',command({...data,status:'calibrating',calibration_validation:{decision_id:'forged',source_profile:{id,version},source_hash:'a'.repeat(64),report_hash:'b'.repeat(64)}})));
 const evaluation={id:'test_eval',version:1,created_at:new Date().toISOString(),author:'test',changes:[],target:{id:'asset',version:1},method:'operational_policy',status:'approved',criteria:[{name:'semantic_fit',mandatory:true,result:'pass',evidence:'Test',timecode_seconds:null,corrective_action:null}]};
 assert.equal(EvaluationSchema.safeParse(evaluation).success,false,'Operational evaluations require a policy reference');
}));

test('Explicit activation binds the tested profile content to a persisted decision; replay cannot activate another revision',async()=>fixture(async({db,service})=>{
 const {profile,article,catalog}=await configure(service,db),{id,version,created_at,author,changes,calibration_validation,...body}=profile;
 const calibrating=await service.save('profiles',{command_id:randomUUID(),expected_version:version,reason:'Nova calibração em fixture de teste.',data:{...body,status:'calibrating',calibration_scope:null}},id) as Profile;
 const productions=new ProductionService(new PostgresProductionStore(db),catalog),production=await productions.create({contract_version:'0.1.0',command_id:randomUUID(),article:{id:article.id,version:article.version},profile:{id:calibrating.id,version:calibrating.version},mode:'calibration',name:'Fixture de decisão'});
 // Seed the trusted persistence boundary to unit-test activation; this is not an actual real-media observation.
 const record={id:'seeded_observation',version:1,sample_type:'real',recorded_by:'test_fixture',recorded_at:new Date().toISOString(),evidence:['test_only'],observation:{production:{id:production.id,version:production.version},profile:production.profile,article_class:'explanation',format:'160x240@30',human_reviewed:true,approved:true,corrections:0,fallbacks:0,currency:'BRL',confirmed_minor:0,human_minutes:1}};
 await db.query('INSERT INTO calibration_observations(id,version,production_id,production_version,profile_id,profile_version,fingerprint,record) VALUES($1,1,$2,$3,$4,$5,$6,$7::jsonb)',[record.id,production.id,production.version,calibrating.id,calibrating.version,sha256(canonical(record)),JSON.stringify(record)]);
 const calibration=new CalibrationService(db),report=await calibration.report(production.profile,{minimum_samples:1,approval_rate:1});
 await calibration.decide({id:'seeded_decision',profile:production.profile,targets:report.targets,report_hash:report.hash,human_reviewed:true,outcome:'validated',reviewer:'test_fixture',reason:'Only fixture activation test.',recorded_at:record.recorded_at});
 const request={command_id:randomUUID(),decision_id:'seeded_decision',profile:production.profile,confirm_activation:true},activated=await calibration.activate(request);
 assert.equal(activated.version,calibrating.version+1);assert.equal(activated.status,'validated');assert.deepEqual(await calibration.activate(request),activated);
 const store=new PostgresConfigurationStore(db);assert.equal(await store.profileCalibration(activated),true);
 const changed=ProfileSchema.parse({...activated,target_seconds:99});assert.equal(await store.profileCalibration(changed),false);
 await assert.rejects(calibration.activate({...request,command_id:randomUUID()}),/stale/);
 const created=await productions.create({contract_version:'0.1.0',command_id:randomUUID(),article:{id:article.id,version:article.version},profile:{id:activated.id,version:activated.version},mode:'recurring',name:'Fixture recorrente com prova'});assert.equal(created.mode,'recurring');
 const {id:activatedId,version:activatedVersion,created_at:activatedAt,author:activatedAuthor,changes:activatedChanges,calibration_validation:proof,...editable}=activated;
 await service.save('profiles',{command_id:randomUUID(),expected_version:activated.version,reason:'Suspender novas produções.',data:{...editable,status:'suspended'}},activated.id);
 await assert.rejects(productions.create({contract_version:'0.1.0',command_id:randomUUID(),article:{id:article.id,version:article.version},profile:{id:activated.id,version:activated.version},mode:'recurring',name:'Histórico suspenso'}),/suspenso/);
}));
