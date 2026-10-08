import test from 'node:test';
import assert from 'node:assert/strict';
import {getPipelineCatalog,SimulatedGenerationAdapter} from '@fbr/pipeline';
import {sha256,canonical} from '@fbr/domain';
import type {GenerationExecution} from '@fbr/contracts';
import {createHiggsfieldAdapter,createHeygenAdapter,type ProviderReceiptStore,type ProviderReceiptRecord,type NormalizedProviderConfig} from '../src/normalized-provider-adapters.js';
import {HiggsfieldClient} from '../src/higgsfield-client.js';
import {HeygenClient} from '../src/heygen-client.js';
import {providerQuoteRequestHash,validateProviderQuote} from '../src/provider-estimates.js';
import type {HttpTransmissionJournal} from '../src/http-generation-adapter.js';
class MemoryJournal implements HttpTransmissionJournal{
  readonly records=new Map<string,unknown>();
  async pin(adapter:string,req:Parameters<HttpTransmissionJournal['pin']>[1],payload:unknown){const key=`${adapter}:${req.execution_key}:${req.attempt}`,old=this.records.get(key);
    if(old&&canonical(old)!==canonical(payload))throw new Error('provider_http_intention_changed');this.records.set(key,structuredClone(payload));}
  async get(adapter:string,req:Parameters<HttpTransmissionJournal['pin']>[1]){return this.records.get(`${adapter}:${req.execution_key}:${req.attempt}`)??null;}
}
class MemoryReceipts implements ProviderReceiptStore {
  records=new Map<string,ProviderReceiptRecord>();
  async get(adapter:string,id:string){return this.records.get(`${adapter}:${id}`)??null;}
  async find(adapter:string,key:string,attempt:number){return [...this.records.entries()].find(([id,r])=>id.startsWith(`${adapter}:`)&&r.request.execution_key===key&&r.request.attempt===attempt)?.[1]??null;}
  async save(adapter:string,id:string,update:(r:ProviderReceiptRecord|null)=>ProviderReceiptRecord){const next=update(await this.get(adapter,id));this.records.set(`${adapter}:${id}`,next);return next;}
}
const request={contract_version:'0.1.0' as const,execution_key:sha256('normalized-test'),attempt:1,production:{id:'p',version:1},shot:{id:'shot',version:1},
  operation:'image' as const,route:'still_image' as const,input_assets:[],references:[],configuration_hash:sha256('config'),parameters:{prompt:'Fixture',_fbr:{step:'image'}},currency:'USD',reserved_minor:10};
test('Higgsfield normalizes durable receipts, late billing, stable outputs and strips private envelope',async()=>{
  const model=getPipelineCatalog().models.find(m=>m.id==='hf_soul_standard_image')!,receipts=new MemoryReceipts();
  const caps=await new SimulatedGenerationAdapter('image').capabilities();let billed=false,sends=0,status='queued',amount=7,billingCurrency='USD';
  const client=new HiggsfieldClient(()=> 'fixture-key',async(url,init)=>{
    let payload:unknown;
    if(String(url).includes('/status/'))payload={request_id:'req1',status,...(status==='completed'?{images:[{url:'https://storage.example/output.png'}]}:{})};
    else {sends++;assert.deepEqual(JSON.parse(String(init?.body)),{prompt:'Fixture'});payload={request_id:'req1',status:'queued',status_url:'https://api.higgsfield.ai/status/req1',cancel_url:'https://api.higgsfield.ai/cancel/req1'};}
    return new Response(JSON.stringify(payload),{headers:{'Content-Type':'application/json'}});
  });
  const config:NormalizedProviderConfig={model,receipts,account_scope:'fixture-account',capabilities:{...caps,adapter_id:'hf_image',mode:'real',evidence_refs:['mock-contract'],supports_idempotent_recovery:true},
    journal:{async pin(_id,_req,payload){assert.equal((payload as {account_scope:string}).account_scope,'fixture-account');}},download:async()=>new Uint8Array([1,2]),
    billing:{async resolve(){return billed?{currency:billingCurrency,confirmed_minor:amount,evidence:'fixture-invoice'}:null;}}};
  const adapter=createHiggsfieldAdapter(config,client,payload=>(payload as {images:{url:string}[]}).images.map(i=>i.url));
  const submitted=await adapter.submit(request);assert.equal(submitted.outcome,'accepted');if(submitted.outcome!=='accepted')throw new Error('unexpected');
  assert.equal(submitted.job.status,'queued');assert.equal(submitted.job.costs.confirmed_minor,null);
  status='completed';const completed=await adapter.query('req1');if(completed.outcome!=='accepted')throw new Error('unexpected');
  assert.equal(completed.job.version,2);assert.equal(completed.job.costs.confirmed_minor,null);assert.equal(completed.job.output_assets.length,1);
  const execution={provider_job:completed.job,intent:{adapter_id:'hf_image'}} as GenerationExecution;
  const resolved=await adapter.resolve(execution);assert.equal(resolved[0]?.id,completed.job.output_assets[0]?.id);assert.equal(resolved[0]?.usage.permission,'unknown');
  billed=true;const invoice=await adapter.query('req1');if(invoice.outcome!=='accepted')throw new Error('unexpected');
  assert.equal(invoice.job.version,3);assert.equal(invoice.job.costs.confirmed_minor,7);assert.deepEqual(invoice.job.output_assets,completed.job.output_assets);
  assert.equal((await adapter.query('req1')).outcome,'accepted');assert.equal(receipts.records.values().next().value?.job.version,3);
  amount=3;const refund=await adapter.query('req1');if(refund.outcome!=='accepted')throw new Error('unexpected');
  assert.equal(refund.job.costs.confirmed_minor,3);assert.equal(refund.job.version,4);assert.equal(receipts.records.values().next().value?.billing_history.length,2);
  billingCurrency='BRL';assert.equal((await adapter.query('req1')).outcome,'accepted');assert.equal(receipts.records.values().next().value?.job.version,4);
  assert.equal((await adapter.resolve(execution))[0]?.id,completed.job.output_assets[0]?.id);
  await adapter.recover(request);assert.equal(sends,1);
  await assert.rejects(createHiggsfieldAdapter({...config,account_scope:'other-account'},client,()=>[]).query('req1'),/receipt_missing/);
  await assert.rejects(adapter.submit({...request,parameters:{prompt:'Different'}}),/intention_changed/);
  await assert.rejects(createHiggsfieldAdapter({...config,receipts:new MemoryReceipts(),prepareParameters:async()=>({prompt:'Tampered after quote'})},client,()=>[]).submit(request),/quoted_parameters_changed/);
  status='surprise';await assert.rejects(adapter.query('req1'));
});
test('HeyGen synchronous audio retains unknown cost and ambiguous sends are not retried',async()=>{
  const model=getPipelineCatalog().models.find(m=>m.id==='heygen_official_voice')!,caps=await new SimulatedGenerationAdapter('audio').capabilities();
  let sends=0;
  const client=new HeygenClient(()=> 'fixture-key',async()=>{sends++;return new Response(JSON.stringify({data:{request_id:'audio1',audio_url:'https://storage.example/audio.mp3',duration:1,engine:'orca'}}),{headers:{'Content-Type':'application/json'}});});
  const config:NormalizedProviderConfig={model,receipts:new MemoryReceipts(),account_scope:'fixture-account',capabilities:{...caps,adapter_id:'heygen_voice',mode:'real',can_cancel_job:false,supported_fields:model.parameters.map(p=>p.name),evidence_refs:['mock-contract']},journal:{async pin(){}},download:async()=>new Uint8Array([1])};
  const adapter=createHeygenAdapter(config,client),audio={...request,operation:'audio' as const,route:null,shot:null,references:[{id:'official_voice',version:1}],parameters:{text:'Fixture.',voice_id:'fixture_voice'}};
  const result=await adapter.submit(audio);if(result.outcome!=='accepted')throw new Error('unexpected');assert.equal(result.job.status,'succeeded');assert.equal(result.job.costs.confirmed_minor,null);
  await adapter.query('audio1');assert.equal(sends,1);await assert.rejects(adapter.recover(audio),/unsupported/);
  let ambiguous=0;const broken=createHeygenAdapter({...config,receipts:new MemoryReceipts()},new HeygenClient(()=> 'fixture-key',async()=>{ambiguous++;throw new Error('lost');}));
  await assert.rejects(broken.submit(audio));assert.equal(ambiguous,1);
  await assert.rejects(createHeygenAdapter({...config,receipts:new MemoryReceipts(),prepareParameters:async()=>({...audio.parameters,text:'Different spoken text'})},client).submit(audio),/quoted_parameters_changed/);
  await assert.rejects(createHeygenAdapter({...config,receipts:new MemoryReceipts(),prepareParameters:async()=>({...audio.parameters,speed:2})},client).submit(audio),/quoted_parameters_changed/);
});
test('Provider quotes require exact request/account/currency and expire without inferred FX',()=>{
  const intent={adapter_id:'hf_image',request,estimate:{currency:'USD',upper_minor:10,evidence:'quote'}};
  const quote={adapter_id:'hf_image',account_scope:'account',request_hash:providerQuoteRequestHash(request),currency:'USD',upper_minor:10,
    quoted_at:'2026-10-06T12:00:00.000Z',expires_at:'2026-10-06T12:30:00.000Z',evidence:'authenticated estimate'};
  assert.equal(validateProviderQuote(quote,intent,'account',new Date('2026-10-06T12:10:00Z')).upper_minor,10);
  assert.throws(()=>validateProviderQuote(quote,intent,'account',new Date('2026-10-06T12:30:00Z')),/expired/);
  assert.throws(()=>validateProviderQuote({...quote,currency:'BRL'},intent,'account',new Date('2026-10-06T12:10:00Z')),/currency/);
  assert.throws(()=>validateProviderQuote(quote,{...intent,request:{...request,parameters:{prompt:'changed'}}},'account',new Date('2026-10-06T12:10:00Z')),/changed/);
});
test('Idempotent recovery replays pinned signed input URL byte-exact without signing/uploading again',async()=>{
  const model=getPipelineCatalog().models.find(m=>m.id==='hf_seedance2_image_animation')!,caps=await new SimulatedGenerationAdapter('animation').capabilities();
  const animation={...request,operation:'animation' as const,route:'animated_scene' as const,input_assets:[{id:'approved_image',version:2}],
    parameters:{prompt:'Fixture animation',image_url:'https://storage.example/placeholder',duration:4,generate_audio:false}};
  const bodies:string[]=[],keys:string[]=[];let signatures=0,boundaries=0;
  const client=new HiggsfieldClient(()=> 'fixture-key',async(_url,init)=>{
    bodies.push(String(init?.body));keys.push(new Headers(init?.headers).get('Idempotency-Key')!);
    if(bodies.length===1)throw new Error('response lost after accepted send');
    return new Response(JSON.stringify({request_id:'recovered_animation',status:'queued',status_url:'https://api.higgsfield.ai/status/recovered',cancel_url:'https://api.higgsfield.ai/cancel/recovered'}),{headers:{'Content-Type':'application/json'}});
  });
  const config:NormalizedProviderConfig={model,capabilities:{...caps,adapter_id:'hf_animation',mode:'real',evidence_refs:['fixture_idempotency'],supports_idempotent_recovery:true},
    receipts:new MemoryReceipts(),journal:new MemoryJournal(),account_scope:'fixture-account',download:async()=>new Uint8Array([1]),input_url_fields:['image_url'],
    async prepareParameters(){signatures++;return {...animation.parameters,image_url:`https://storage.example/image.png?signature=${signatures}`};},async beforeSend(){boundaries++;}};
  const adapter=createHiggsfieldAdapter(config,client,()=>[]);
  await assert.rejects(adapter.submit(animation));assert.equal(signatures,1);
  const recovered=await adapter.recover(animation);assert.equal(recovered.outcome,'accepted');assert.equal(signatures,1);assert.equal(boundaries,2);
  assert.equal(bodies[0],bodies[1]);assert.equal(keys[0],keys[1]);assert.match(bodies[1]!,/signature=1/);
});
test('Quote expiring during preparation blocks initial send and idempotent recovery at the final boundary',async()=>{
  const model=getPipelineCatalog().models.find(m=>m.id==='hf_soul_standard_image')!,caps=await new SimulatedGenerationAdapter('image').capabilities();
  const quote={adapter_id:'hf_image',account_scope:'account',request_hash:providerQuoteRequestHash(request),currency:'USD',upper_minor:10,
    quoted_at:'2026-10-07T12:00:00.000Z',expires_at:'2026-10-07T12:01:00.000Z',evidence:'fixture_quote'};
  const intent={adapter_id:'hf_image',request,estimate:{currency:'USD',upper_minor:10,evidence:'fixture_quote'}};let sends=0,now=new Date('2026-10-07T12:00:30Z');
  validateProviderQuote(quote,intent,'account',now);
  const client=new HiggsfieldClient(()=> 'fixture-key',async()=>{sends++;throw new Error('must not send');});
  const adapter=createHiggsfieldAdapter({model,capabilities:{...caps,adapter_id:'hf_image',mode:'real',evidence_refs:['fixture_schema'],supports_idempotent_recovery:true},
    receipts:new MemoryReceipts(),journal:new MemoryJournal(),account_scope:'account',download:async()=>new Uint8Array([1]),
    async prepareParameters(){now=new Date('2026-10-07T12:01:01Z');return {prompt:request.parameters.prompt};},
    async beforeSend(){validateProviderQuote(quote,intent,'account',now);}},client,()=>[]);
  await assert.rejects(adapter.submit(request),/quote_expired/);assert.equal(sends,0);
  await assert.rejects(adapter.recover(request),/quote_expired/);assert.equal(sends,0);
});
