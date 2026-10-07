import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {getPipelineCatalog} from '@fbr/pipeline';
import {articleFixture,profileFixture,dossierFixture,productionFixture,universeConfigurationFixture} from '@fbr/contracts/fixtures';
import type {AssetStore,AdapterRequest,GenerationIntent} from '@fbr/contracts';
import type {SqlClient,SqlDatabase} from '../src/configuration-store.js';
import type {PipelineOperationContext} from '../src/production-pipeline.js';
import {createRealPipelineBindings,type RealPipelineConfig} from '../src/real-pipeline-bindings.js';
import {providerQuoteRequestHash} from '../src/provider-estimates.js';
test('Real composition loads offline, persists exact quotes, survives restart and closes unconfigured routes',async()=>{
  const engine=new PGlite();const wrap=(client:Pick<PGlite,'query'|'exec'>):SqlClient=>({async query(sql,values){
    if(values===undefined){const r=(await client.exec(sql)).at(-1);return{rows:r?.rows as Record<string,unknown>[]??[],rowCount:r?.affectedRows??0};}
    const r=await client.query<Record<string,unknown>>(sql,values);return{rows:r.rows,rowCount:r.affectedRows??0};}});
  const db:SqlDatabase={...wrap(engine),transaction:run=>engine.transaction(tx=>run(wrap(tx)))};
  const files:AssetStore={async read(){throw new Error('unused');},async exists(){return false;},async putImmutable(){throw new Error('unused');}};
  try{
    await db.query(await readFile(new URL('../migrations/012_provider_events.sql',import.meta.url),'utf8'));
    const model=getPipelineCatalog().models.find(m=>m.id==='heygen_official_voice')!;
    let networkCalls=0,authorized=true,quoted:AdapterRequest|null=null;
    const config:RealPipelineConfig={media_origins:['https://storage.example'],network:async()=>{networkCalls++;throw new Error('must not call');},operations:{audio:{vendor:'heygen',adapter_id:'real_voice',model,
      enabled:true,account_scope:'offline_fixture_account',evidence_refs:['mock_schema'],key:()=> 'fixture',authorize:async()=>authorized,
      parameters:async ctx=>({text:ctx.text,voice_id:'fixture_voice'}),prepareParameters:async req=>({text:req.parameters.text!,voice_id:'fixture_voice'}),billing:{async resolve(){return null;}},
      async quote(request){quoted=request;return{adapter_id:'real_voice',account_scope:'offline_fixture_account',request_hash:providerQuoteRequestHash(request),currency:'BRL',upper_minor:12,
        quoted_at:new Date(Date.now()-1000).toISOString(),expires_at:new Date(Date.now()+60000).toISOString(),evidence:'Synthetic quote contract only; no spending authorization.'};}}}};
    const runtime=await createRealPipelineBindings(config,{db,files});assert.equal(networkCalls,0);assert.equal(runtime.bindings.image,undefined);
    const snapshot={production_id:productionFixture.id,captured_at:'2026-10-04T12:00:00Z',hash:'a'.repeat(64),article:articleFixture,profile:profileFixture,
      character:universeConfigurationFixture.characters[0]!,references:[],bible_original:'fixture',catalog:getPipelineCatalog(),
      request:{contract_version:'0.1.0' as const,command_id:'fixture_cmd',article:{id:articleFixture.id,version:1},profile:{id:profileFixture.id,version:1},name:'fixture',mode:'calibration' as const}};
    const ctx:PipelineOperationContext={production:productionFixture,dossier:dossierFixture,snapshot,operation:'audio',shot:null,text:'Fixture.',inputs:[],
      step:{step:'a'.repeat(64),requires:[],specification:{id:dossierFixture.id,version:1},speech_id:'speech',width:1080,height:1920,duration_seconds:1}};
    const estimate=await runtime.bindings.audio!.estimate(ctx);assert.equal(networkCalls,0);assert.ok(quoted);
    const draft=quoted as AdapterRequest,intent:GenerationIntent={adapter_id:'real_voice',request:{...draft,reserved_minor:estimate.upper_minor},estimate};
    await runtime.bindings.audio!.validateIntent!(intent);assert.equal(await runtime.admission(intent,productionFixture),true);
    const restarted=await createRealPipelineBindings(config,{db,files});await restarted.bindings.audio!.validateIntent!(intent);
    authorized=false;assert.equal(await restarted.admission(intent,productionFixture),false);authorized=true;
    assert.equal(await restarted.admission({...intent,request:{...intent.request,parameters:{text:'changed'}}},productionFixture),false);
    await db.query("UPDATE provider_quotes SET record=jsonb_set(record,'{expires_at}',to_jsonb('2020-01-01T00:00:00.000Z'::text))");
    assert.equal(await restarted.admission(intent,productionFixture),false);assert.equal(networkCalls,0);
  }finally{await engine.close();}
});
