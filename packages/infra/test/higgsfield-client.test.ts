import test from 'node:test';
import assert from 'node:assert/strict';
import {getPipelineCatalog} from '@fbr/pipeline';
import {sha256} from '@fbr/domain';
import {HiggsfieldClient,ProviderMediaTransfer} from '../src/index.js';
const model=getPipelineCatalog().models.find(model=>model.id==='hf_soul_standard_image')!;
const request={contract_version:'0.1.0' as const,execution_key:sha256('higgsfield-test'),attempt:1,production:{id:'p',version:1},shot:{id:'shot',version:1},
  operation:'image' as const,route:'still_image' as const,input_assets:[],references:[],configuration_hash:sha256('config'),parameters:{prompt:'Cena sintética'},currency:'USD',reserved_minor:10};
test('Higgsfield REST prepara estimativa, recibo, upload e cancelamento sem presumir cobrança/câmbio',async()=>{
  const calls:{url:string;headers:Headers;body:unknown}[]=[],receipt={request_id:'req_fixture',status:'queued' as const,status_url:'https://api.higgsfield.ai/status/fixture',cancel_url:'https://api.higgsfield.ai/cancel/fixture'};
  let cancelled=false;
  const client=new HiggsfieldClient(()=> 'fixture-key-not-secret',async(url,init)=>{
    calls.push({url:String(url),headers:new Headers(init?.headers),body:init?.body?JSON.parse(String(init.body)):null});
    let result:unknown=receipt;
    if(String(url).includes('/estimate/'))result={credits:'1.500',usd:'0.094'};
    else if(String(url).includes('/status/'))result={request_id:receipt.request_id,status:cancelled?'canceled':'queued'};
    else if(String(url).includes('/cancel/')){cancelled=true;return new Response(null,{status:202});}
    else if(String(url).includes('/files/'))result={upload_url:'https://storage.example/upload?signature=fixture',public_url:'https://storage.example/public',content_type:'image/png',upload_headers:{'Content-Type':'image/png','x-amz-tagging':'retention=temporary'}};
    return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});
  });
  const quote=await client.estimate(model,request);assert.equal(quote.upper_minor,10);assert.equal(quote.currency,'USD');
  const accepted=await client.submit(model,request);assert.equal(accepted.request_id,receipt.request_id);
  assert.equal(calls[1]!.headers.get('Idempotency-Key'),`${request.execution_key}:1`);
  assert.equal((await client.cancel(accepted)).status,'canceled');
  const transfer=new ProviderMediaTransfer(['https://storage.example'],{async transfer(_url,method,headers){assert.equal(method,'PUT');assert.equal(headers.Authorization,undefined);assert.equal(headers['x-amz-tagging'],'retention=temporary');return {bytes:new Uint8Array(),mime_type:null};}});
  assert.equal(await client.upload('image/png',new Uint8Array([1,2,3]),transfer),'https://storage.example/public');
  await assert.rejects(client.status({...receipt,status_url:'https://other.example/status'}),/origin_denied/);
  await assert.rejects(client.submit(model,{...request,parameters:{unknown:'value'}}),/request_invalid/);
});
