import test from 'node:test';
import assert from 'node:assert/strict';
import {HttpGenerationAdapter,type ProviderHttpBinding} from '../src/http-generation-adapter.js';
import {SimulatedGenerationAdapter} from '@fbr/pipeline';
import {sha256} from '@fbr/domain';
const request={contract_version:'0.1.0' as const,execution_key:sha256('http-test'),attempt:1,production:{id:'production',version:1},shot:null,
  operation:'audio' as const,route:null,input_assets:[],references:[],configuration_hash:sha256('config'),parameters:{text:'Teste',voice_reference:'voice'},currency:'BRL',reserved_minor:0};
test('Adapter HTTP provisionável fixa origem/idempotência, normaliza resposta e não segue redirects',async()=>{
  const simulator=new SimulatedGenerationAdapter('audio'),caps=await simulator.capabilities();
  const calls:{url:string;init:RequestInit}[]=[];
  const binding:ProviderHttpBinding={capabilities:{...caps,adapter_id:'test_audio',mode:'real',evidence_refs:['schema_test']},origin:'https://provider.example',account_scope:'account_fixture',
    headers:()=>({Authorization:'Key fixture-not-secret'}),validate:async()=>{},submit:req=>({path:'/submit',body:req.parameters}),query:id=>`/jobs/${encodeURIComponent(id)}`,cancel:id=>`/jobs/${encodeURIComponent(id)}/cancel`,
    decode:async()=>simulator.submit(request)};
  const adapter=new HttpGenerationAdapter(binding,async(url,init)=>{calls.push({url:String(url),init:init!});return new Response('{}',{headers:{'Content-Type':'application/json'}});});
  assert.equal((await adapter.submit(request)).outcome,'accepted');assert.equal(calls[0]!.url,'https://provider.example/submit');
  assert.equal(new Headers(calls[0]!.init.headers).get('Idempotency-Key'),`${request.execution_key}:1`);assert.equal(calls[0]!.init.redirect,'error');
  await adapter.query('a/b');assert.equal(calls[1]!.url,'https://provider.example/jobs/a%2Fb');
  await assert.rejects(new HttpGenerationAdapter({...binding,submit:()=>({path:'https://other.example/steal',body:{}})},async()=>{throw new Error('must not send');}).submit(request),/outside_origin/);
  await assert.rejects(adapter.submit({...request,parameters:{unmapped:'x'}}),/capability/);
  await assert.rejects(new HttpGenerationAdapter(binding,async()=>new Response('secret-error',{status:500})).submit(request),/provider_http_failure/);
});
