import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {GenerationExecution,GenerationQueue} from '@fbr/contracts';
import type {SqlClient,SqlDatabase} from '../src/configuration-store.js';
import {ProviderCallbackInbox,reconcileProviderReceipts} from '../src/provider-callback-inbox.js';
test('Durable callback inbox authenticates, deduplicates, retries and ignores alleged outputs/costs',async()=>{
  const engine=new PGlite();
  const wrap=(client:Pick<PGlite,'query'|'exec'>):SqlClient=>({async query(sql,values){
    if(values===undefined){const result=(await client.exec(sql)).at(-1);return {rows:result?.rows as Record<string,unknown>[]??[],rowCount:result?.affectedRows??0};}
    const result=await client.query<Record<string,unknown>>(sql,values);return {rows:result.rows,rowCount:result.affectedRows??0};
  }});
  const db:SqlDatabase={...wrap(engine),transaction:run=>engine.transaction(tx=>run(wrap(tx)))};
  try{
    await db.query(await readFile(new URL('../migrations/012_provider_events.sql',import.meta.url),'utf8'));
    const execution={id:'exec',state:'active',intent:{adapter_id:'vendor'},provider_job:{external_job_id:'receipt'}} as GenerationExecution;
    const unsupported=async()=>{throw new Error('callback must not mutate queue directly');};
    const queue:GenerationQueue={get:async(id:string)=>id==='exec'?execution:null,list:async()=>[execution],enqueue:unsupported,claim:unsupported,complete:unsupported,uncertain:unsupported,cancelPrepared:unsupported};
    let authorized=true,queries=0;const inbox=new ProviderCallbackInbox(db,queue,async()=>authorized);
    const signal={adapter_id:'vendor',event_id:'event1',execution_id:'exec',payload:{status:'completed',confirmed_minor:0,asset:'untrusted'}};
    assert.equal((await inbox.receive(signal)).duplicate,false);assert.equal((await inbox.receive(signal)).duplicate,true);
    await assert.rejects(inbox.receive({...signal,payload:{status:'changed'}}),/identity_changed/);
    authorized=false;await assert.rejects(inbox.receive({...signal,event_id:'event2'}),/authentication/);authorized=true;
    assert.deepEqual(await inbox.drain(async()=>{queries++;throw new Error('provider unavailable');}),{completed:0,failed:1});
    assert.equal(queries,1);assert.equal((await db.query('SELECT processed_at FROM provider_callback_inbox')).rows[0]?.processed_at,null);
    await db.query("UPDATE provider_callback_inbox SET next_attempt_at=now()-interval '1 second'");
    const restarted=new ProviderCallbackInbox(db,queue,async()=>true);
    assert.deepEqual(await restarted.drain(async id=>{queries++;assert.equal(id,'exec');return {...execution,state:'succeeded'};}),{completed:1,failed:0});
    assert.deepEqual(await restarted.drain(async()=>{throw new Error('must not query');}),{completed:0,failed:0});
    assert.equal(queries,2);
    assert.deepEqual(await reconcileProviderReceipts(queue,['p','p'],async()=>({...execution,state:'unknown'})),{checked:1,pending:1});
  }finally{await engine.close();}
});
