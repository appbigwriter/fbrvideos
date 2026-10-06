import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { ArticleSchema,ProfileSchema,CharacterSchema,ReferenceSchema,DossierSchema,ProductionDetailSchema } from '@fbr/contracts';
import { dossierFixture,fixtureDelivery } from '@fbr/contracts/fixtures';
import { ConfigurationService,ProductionService,canonical,sha256 } from '@fbr/domain';
import { getPipelineCatalog, AutomaticPlanner } from '@fbr/pipeline';
import { PostgresDatabase,PostgresConfigurationStore,PostgresProductionStore,PostgresInferenceJournal,migrateConfiguration,type SqlDatabase,type SqlClient } from '../src/index.js';
import { buildApp } from '../../../apps/api/src/app.js';
let db:SqlDatabase,close:()=>Promise<void>,configuration:ConfigurationService,productions:ProductionService;
before(async()=>{
  if(process.env.TEST_DATABASE_URL){const pg=new PostgresDatabase(process.env.TEST_DATABASE_URL);db=pg;close=()=>pg.close();}
  else {
    const engine=new PGlite();
    const wrap=(client:Pick<PGlite,'query'|'exec'>):SqlClient=>({async query(sql,values){
      if(values===undefined){const result=(await client.exec(sql)).at(-1);return{rows:result?.rows as Record<string,unknown>[]??[],rowCount:result?.affectedRows??0};}
      const result=await client.query<Record<string,unknown>>(sql,values);return{rows:result.rows,rowCount:result.affectedRows??0};
    }});
    db={...wrap(engine),transaction:run=>engine.transaction(tx=>run(wrap(tx)))};close=()=>engine.close();
  }
  await migrateConfiguration(db);configuration=new ConfigurationService(new PostgresConfigurationStore(db));
  productions=new ProductionService(new PostgresProductionStore(db),getPipelineCatalog());
});
after(async()=>close?.());
const save=(data:unknown,expected_version:number|null=null)=>({command_id:randomUUID(),expected_version,reason:'Ensaio sintético S2',data});
async function inputs(){
  const voice=ReferenceSchema.parse(await configuration.save('references',save({name:'Voz candidata sintética S2',kind:'voice',status:'pending',asset_refs:[],rules:[],usage_permission:'unknown'})));
  const character=CharacterSchema.parse(await configuration.save('characters',save({name:'Personagem sintética S2',status:'confirmed',bible_original:'# Original S2\r\nNão substituir.',interpretation:'Leitura confirmada de ensaio.',interpretation_confirmed:true,references:[],voice:{id:voice.id,version:1},authorized_variations:[]})));
  const article=ArticleSchema.parse(await configuration.save('articles',save({title:'Fonte sintética S2',source_author:'Autora sintética',content:'Ajustar notificações reduz interrupções.',complete:true,character:{id:character.id,version:1}})));
  const profile=ProfileSchema.parse(await configuration.save('profiles',save({name:'Perfil sintético S2',status:'calibrating',character:{id:character.id,version:1},language:'pt-BR',target_seconds:8,recipe:'explanation',
    voice:{id:voice.id,version:1},permitted_shot_classes:['editorial_illustration'],permitted_references:[],delivery:fixtureDelivery,budget:{currency:'BRL',ceiling_minor:10000,safety_margin_minor:1000,max_attempts_per_job:2},calibration_scope:null})));
  return{article,profile,character,request:{contract_version:'0.1.0',command_id:randomUUID(),article:{id:article.id,version:1},profile:{id:profile.id,version:1},name:'Produção sintética S2',mode:'calibration'}};
}

test('Diário OAuth deduplica chamadas, conserva falha/timeout e recusa fingerprint diferente',async()=>{
  const journal=new PostgresInferenceJournal(db),key=randomUUID(),fingerprint=randomUUID();let calls=0;
  const result={value:{status:'ok'},usage:{input_tokens:10,output_tokens:2}};
  const run=async()=>{calls++;return result;};
  assert.deepEqual(await journal.run(key,fingerprint,run),result);
  assert.deepEqual(await journal.run(key,fingerprint,run),result);assert.equal(calls,1);
  const cached=await journal.run(randomUUID(),fingerprint,run);assert.equal(cached.reused,true);assert.equal(cached.source_execution_key,key);assert.equal(calls,1);
  await assert.rejects(journal.run(key,'different',run),/oauth_execution_conflict/);
  const failed=randomUUID();await assert.rejects(journal.run(failed,'f',async()=>{throw new Error('timeout');}),/timeout/);
  await assert.rejects(journal.run(failed,'f',run),/oauth_execution_unknown/);assert.equal(calls,1);
  const active=randomUUID();await db.query("INSERT INTO planning_inferences(execution_key,fingerprint,state) VALUES ($1,'f','running')",[active]);
  await assert.rejects(journal.run(active,'f',run),/oauth_execution_busy/);
  const expired=randomUUID();await db.query("INSERT INTO planning_inferences(execution_key,fingerprint,state,started_at) VALUES ($1,'f','running',CURRENT_TIMESTAMP-INTERVAL '5 minutes')",[expired]);
  await assert.rejects(journal.run(expired,'f',run),/oauth_execution_unknown/);
  await assert.rejects(db.query('UPDATE planning_inferences SET result=result WHERE execution_key=$1',[key]),/Immutable inference evidence/);
});

test('Planejamento automático persiste dossiê, recupera interrupção e replay não duplica eventos',async()=>{
  const source=await inputs(),created=await productions.create(source.request);
  await productions.planning({command_id:randomUUID(),production:{id:created.id,version:1},action:'planning_started'});
  const planner=new AutomaticPlanner(productions);
  await Promise.all([planner.run(created.id),planner.run(created.id)]);
  const detail=await productions.detail(created.id);
  assert.equal(detail.production.status,'awaiting_decision');assert.equal(detail.events.length,3);
  assert.equal(detail.dossier!.blocks[0]!.speeches[1]!.text,source.article.content);
  assert.equal(detail.production.costs.confirmed_minor,0);assert.equal(detail.dossier!.jobs.length,0);
  await new AutomaticPlanner(productions).run(created.id);
  assert.deepEqual(await productions.detail(created.id),detail);
});
test('API cria e planeja sem aceitar dossiê externo; falha explicável e pausa preservada',async()=>{
  const source=await inputs(),planner=new AutomaticPlanner(productions);
  const app=buildApp(configuration,{productions,planner});
  try {
    const response=await app.inject({method:'POST',url:'/api/productions',headers:{host:'localhost'},payload:source.request});
    assert.equal(response.statusCode,201);assert.equal(response.json().status,'awaiting_decision');
    const replay=await app.inject({method:'POST',url:'/api/productions',headers:{host:'localhost'},payload:source.request});
    assert.equal(replay.json().version,3);
    const failed=await productions.create({...source.request,command_id:randomUUID(),overrides:{editorial_scope:'Selecionar conclusão'}});
    await planner.run(failed.id);
    const result=await productions.detail(failed.id);assert.equal(result.production.status,'failed');assert.equal(result.dossier,null);
    assert.equal(result.production.pending_issues[0]!.code,'editorial_scope_unsupported');
    const paused=await productions.create({...source.request,command_id:randomUUID()});
    await productions.command({command_id:randomUUID(),production:{id:paused.id,version:1},action:'pause'});
    await planner.run(paused.id);assert.equal((await productions.detail(paused.id)).production.status,'paused');
  } finally {await app.close();}
});

test('Dois planejadores deduplicam no banco; pausa entre início e conclusão impede gravação tardia',async()=>{
  const source=await inputs(),created=await productions.create(source.request);
  await Promise.all([new AutomaticPlanner(productions).run(created.id),new AutomaticPlanner(productions).run(created.id)]);
  assert.equal((await productions.detail(created.id)).events.length,3);
  class PausingService extends ProductionService {
    override async planning(raw:unknown) {
      const result=await super.planning(raw);
      if(result.stage==='script_direction'&&result.status==='preparing')
        await super.command({command_id:randomUUID(),production:{id:result.id,version:result.version},action:'pause'});
      return result;
    }
  }
  const pausing=new PausingService(new PostgresProductionStore(db),getPipelineCatalog());
  const interrupted=await pausing.create({...source.request,command_id:randomUUID()});
  await new AutomaticPlanner(pausing).run(interrupted.id);
  const detail=await pausing.detail(interrupted.id);
  assert.equal(detail.production.status,'paused');assert.equal(detail.dossier,null);assert.equal(detail.events.length,3);
});
test('Snapshot fixa artigo/perfil/Bible/catálogo; replay e revisão da fonte preservam a produção',async()=>{
  const source=await inputs();const created=await productions.create(source.request);
  assert.deepEqual(await productions.create(source.request),created);
  await assert.rejects(productions.create({...source.request,name:'Outra intenção'}),/outros dados/);
  const {hash,...content}=(await productions.detail(created.id)).snapshot;assert.equal(hash,sha256(canonical(content)));
  await configuration.save('articles',save({title:'Título alterado depois',source_author:'Autora sintética',content:'Texto novo com outra conclusão.',complete:true,character:{id:source.character.id,version:1}},1),source.article.id);
  const detail=await new ProductionService(new PostgresProductionStore(db),getPipelineCatalog()).detail(created.id);
  assert.equal(detail.snapshot.article.title,source.article.title);assert.equal(detail.snapshot.article.version,1);
  assert.equal(detail.snapshot.bible_original,'# Original S2\r\nNão substituir.');assert.equal(detail.events.length,1);
  for(const table of ['production_snapshots','production_revisions','production_events'])await assert.rejects(db.query(`UPDATE ${table} SET record=record`),/Immutable editorial record/);
});
test('Comandos fazem CAS; duas edições não perdem estado e replay não duplica eventos',async()=>{
  const source=await inputs(),created=await productions.create(source.request);
  const pause={command_id:randomUUID(),production:{id:created.id,version:1},action:'pause'};
  const paused=await productions.command(pause);assert.equal(paused.status,'paused');assert.deepEqual(await productions.command(pause),paused);
  const results=await Promise.allSettled(['resume','cancel'].map(action=>productions.command({command_id:randomUUID(),production:{id:created.id,version:2},action})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  const latest=await productions.detail(created.id);assert.equal(latest.production.version,3);assert.equal(latest.events.length,3);
  const historical=await productions.detail(created.id,1);assert.equal(historical.events.length,1);assert.equal(historical.production.status,'preparing');
  await assert.rejects(productions.planning({command_id:randomUUID(),production:{id:created.id,version:1},action:'planning_started'}),/desatualizada/);
});
test('Falha de planejamento não vira conclusão; retomada explícita reinicia preparação',async()=>{
  const source=await inputs(),created=await productions.create(source.request);
  const started=await productions.planning({command_id:randomUUID(),production:{id:created.id,version:1},action:'planning_started'});
  assert.equal(started.stage,'script_direction');
  const failed=await productions.planning({command_id:randomUUID(),production:{id:created.id,version:2},action:'planning_failed'});
  assert.equal(failed.status,'failed');assert.equal(failed.dossier,null);
  await assert.rejects(productions.planning({command_id:randomUUID(),production:{id:created.id,version:3},action:'planning_completed',dossier:dossierFixture}),/Não há planejamento ativo/);
  const resumed=await productions.command({command_id:randomUUID(),production:{id:created.id,version:3},action:'resume'});
  assert.equal(resumed.status,'preparing');assert.equal(resumed.stage,'preparation');
});
test('Dossiê exige fontes e revisões fixadas; gravação é atômica e não libera geração',async()=>{
  const source=await inputs(),created=await productions.create(source.request);
  await productions.planning({command_id:randomUUID(),production:{id:created.id,version:1},action:'planning_started'});
  const dossier=DossierSchema.parse({...dossierFixture,id:randomUUID(),production:{id:created.id,version:2},article:created.article,profile:created.profile,character:created.character,
    assets:[],jobs:[],evaluations:[],approvals:[],timeline:null,pending_issues:[],editorial_sources:[],
    blocks:dossierFixture.blocks.map(block=>({...block,speeches:block.speeches.map(speech=>({...speech,sources:[{kind:'article',document:created.article,segment_id:'segment_1'}]}))})),
    shots:dossierFixture.shots.map(shot=>({...shot,references:{character:null,environment:null,wardrobe:null,props:[],style:null,composition:null},dependencies:[]}))});
  const command={command_id:randomUUID(),production:{id:created.id,version:2},action:'planning_completed',dossier};
  await assert.rejects(productions.planning({...command,command_id:randomUUID(),dossier:{...dossier,article:{...dossier.article,version:99}}}),/entradas fixadas/);
  const broken=DossierSchema.parse({...dossier,blocks:dossier.blocks.map(block=>({...block,speeches:block.speeches.map(speech=>({...speech,sources:[{kind:'article',document:created.article,segment_id:'missing'}]}))}))});
  await assert.rejects(productions.planning({...command,command_id:randomUUID(),dossier:broken}),/trecho ou revisão ausente/);
  assert.equal(await productions.store.dossier(dossier),null);
  const completed=await productions.planning(command);assert.equal(completed.status,'awaiting_decision');assert.equal(completed.current_render,null);
  assert.ok(completed.pending_issues.some(i=>i.required));assert.deepEqual(await productions.planning(command),completed);
  assert.deepEqual((await productions.detail(created.id)).dossier,dossier);
  await assert.rejects(db.query('DELETE FROM production_dossiers WHERE id=$1',[dossier.id]),/Immutable editorial record/);
});
test('Incompletude, ausência de revisão, perfil recorrente e receita experimental bloqueiam criação',async()=>{
  const source=await inputs();await assert.rejects(productions.create({...source.request,article:{...source.request.article,version:999}}),/não encontrado/);
  await assert.rejects(productions.create({...source.request,mode:'recurring'}),/calibração/);
  const incomplete=ArticleSchema.parse(await configuration.save('articles',save({title:'Captura parcial',source_author:'Autora sintética',content:'Captura parcial de teste.',complete:false,character:createdRef(source.character)})));
  await assert.rejects(productions.create({...source.request,article:createdRef(incomplete)}),/incompleta/);
  const {id,version,created_at,author,changes,...profileData}=source.profile;
  const experimental=ProfileSchema.parse(await configuration.save('profiles',save({...profileData,recipe:'demonstrative_tutorial',permitted_shot_classes:['simple_interaction']},1),id));
  await assert.rejects(productions.create({...source.request,profile:createdRef(experimental)}),/experimental/);
});
const createdRef=(r:{id:string;version:number})=>({id:r.id,version:r.version});
test('API expõe revisões/eventos e comandos; não oferece endpoint de conclusão fictícia',async()=>{
  const source=await inputs();const app=buildApp(configuration,{productions});
  try{
    const created=await app.inject({method:'POST',url:'/api/productions',payload:source.request});assert.equal(created.statusCode,201);
    const id=created.json().id as string;const detail=await app.inject({method:'GET',url:`/api/productions/${id}`});assert.equal(detail.statusCode,200);ProductionDetailSchema.parse(detail.json());
    const {id:characterId,version:characterVersion,created_at,author,changes,bible,...characterData}=source.character;
    await configuration.save('characters',save({...characterData,name:'Nome atualizado depois',interpretation:bible.interpretation,interpretation_confirmed:true},1),characterId);
    const pinned=await app.inject({method:'GET',url:`/api/profiles/${source.profile.id}/universe?version=1`});assert.equal(pinned.statusCode,200);
    assert.ok(pinned.json().characters.some((c:{id:string;version:number})=>c.id===characterId&&c.version===1));
    assert.ok(pinned.json().characters.some((c:{id:string;version:number})=>c.id===characterId&&c.version===2));
    const paused=await app.inject({method:'POST',url:`/api/productions/${id}/commands`,payload:{command_id:randomUUID(),production:{id,version:1},action:'pause'}});assert.equal(paused.statusCode,200);
    assert.equal((await app.inject({method:'GET',url:`/api/productions/${id}?version=1`})).json().production.status,'preparing');
    assert.equal((await app.inject({method:'POST',url:`/api/productions/${id}/planning`,payload:{dossier:dossierFixture}})).statusCode,404);
    assert.equal((await app.inject({method:'POST',url:`/api/productions/${id}/commands`,payload:{command_id:randomUUID(),production:{id:'other',version:2},action:'cancel'}})).statusCode,400);
    assert.equal((await app.inject({method:'GET',url:'/api/productions'})).statusCode,200);
  }finally{await app.close();}
});
