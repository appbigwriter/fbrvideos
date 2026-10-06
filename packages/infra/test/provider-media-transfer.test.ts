import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ProviderMediaTransfer,LocalImmutableAssetStore,type MediaTransferTransport} from '../src/index.js';
test('Transferência provisionável separa credenciais e guarda bytes pelo hash, sem persistir URL assinada',async()=>{
  const root=await mkdtemp(join(tmpdir(),'fbr-provider-transfer-test-'));
  try{
    const calls:{method:string;headers:Record<string,string>}[]=[],bytes=new TextEncoder().encode('Mídia sintética, não é resultado real.');
    const transport:MediaTransferTransport={async transfer(_url,method,headers){calls.push({method,headers});return{bytes,mime_type:'image/png'};}};
    const transfer=new ProviderMediaTransfer(['https://storage.example'],transport),store=new LocalImmutableAssetStore(root);
    const probe=async()=>({mime_type:'image/png',width:160,height:240,duration_seconds:null});
    const file=await transfer.download('https://storage.example/output?signature=fixture',store,probe);
    assert.equal(file.storage_key.includes('signature'),false);assert.deepEqual(Buffer.from(await store.read(file.storage_key)),Buffer.from(bytes));
    assert.deepEqual(calls[0]!.headers,{});
    await transfer.upload('https://storage.example/upload?signature=fixture',{'Content-Type':'image/png'},bytes,'https://storage.example/public');
    assert.equal(calls[1]!.method,'PUT');assert.equal(calls[1]!.headers.Authorization,undefined);
    await assert.rejects(transfer.upload('https://storage.example/upload',{Authorization:'Key never-forward'},bytes,'https://storage.example/public'),/credential_denied/);
    await assert.rejects(transfer.download('https://other.example/output',store,probe),/origin_denied/);
    await assert.rejects(transfer.download('https://storage.example/output',store,async()=>({...await probe(),width:-1})));
    assert.throws(()=>new ProviderMediaTransfer(['https://127.0.0.1'],transport));
  }finally{assert.ok(root.startsWith(join(tmpdir(),'fbr-provider-transfer-test-')));await rm(root,{recursive:true,force:true});}
});
