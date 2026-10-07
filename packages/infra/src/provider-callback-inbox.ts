import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {AdapterResultSchema,type GenerationExecution,type GenerationQueue,type GenerationAdapter} from '@fbr/contracts';
import {canonical,sha256} from '@fbr/domain';
import type {SqlDatabase} from './configuration-store.js';

export interface CallbackSignal {adapter_id:string;event_id:string;execution_id:string;payload:unknown}
const signalSchema=z.strictObject({adapter_id:z.string().regex(/^[\w.:-]+$/).max(150),event_id:z.string().min(1).max(300),
  execution_id:z.string().regex(/^[\w.:-]+$/).max(150),payload:z.json()});
/** Never apply callback content as a job or an invoice. Persist a signal then authenticate/query the adapter. */
export class ProviderCallbackInbox {
  constructor(private readonly db:SqlDatabase,private readonly queue:GenerationQueue,
    private readonly authenticate:(signal:CallbackSignal)=>Promise<boolean>){ }
  async receive(raw:CallbackSignal){const signal=signalSchema.parse(raw);
    if(Buffer.byteLength(canonical(signal.payload))>65536)throw new Error('provider_callback_too_large');
    if(!await this.authenticate(signal))throw new Error('provider_callback_authentication_failed');
    const execution=await this.queue.get(signal.execution_id);
    if(!execution||execution.intent.adapter_id!==signal.adapter_id||!execution.provider_job?.external_job_id)throw new Error('provider_callback_execution_mismatch');
    const hash=sha256(canonical(signal.payload));
    return this.db.transaction(async client=>{
      const inserted=await client.query('INSERT INTO provider_callback_inbox(adapter_id,event_id,execution_id,payload_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING event_id',
        [signal.adapter_id,signal.event_id,signal.execution_id,hash]);
      const previous=(await client.query('SELECT execution_id,payload_hash FROM provider_callback_inbox WHERE adapter_id=$1 AND event_id=$2',[signal.adapter_id,signal.event_id])).rows[0];
      if(!previous||previous.execution_id!==signal.execution_id||previous.payload_hash!==hash)throw new Error('provider_callback_identity_changed');
      return {accepted:true as const,duplicate:inserted.rowCount===0};
    });
  }
  async drain(reconcile:(executionId:string)=>Promise<GenerationExecution>,limit=20){
    if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('provider_callback_limit_invalid');
    let completed=0,failed=0;
    for(let i=0;i<limit;i++){
      const token=randomUUID();
      const row=await this.db.transaction(async client=>{
        const pending=(await client.query('SELECT adapter_id,event_id,execution_id,attempts FROM provider_callback_inbox WHERE processed_at IS NULL AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY received_at FOR UPDATE SKIP LOCKED LIMIT 1')).rows[0];
        if(!pending)return null;
        await client.query("UPDATE provider_callback_inbox SET lease_token=$3,lease_until=now()+interval '90 seconds',attempts=attempts+1 WHERE adapter_id=$1 AND event_id=$2",[pending.adapter_id,pending.event_id,token]);return pending;
      });if(!row)break;
      try{
        const current=await this.queue.get(String(row.execution_id));
        if(!current||current.intent.adapter_id!==row.adapter_id||!current.provider_job?.external_job_id)throw new Error('callback_execution_mismatch');
        const result=await reconcile(current.id);
        if(result.state==='unknown')throw new Error('callback_reconciliation_uncertain');
        await this.db.query('UPDATE provider_callback_inbox SET processed_at=now(),lease_until=NULL,lease_token=NULL,diagnostic=NULL WHERE adapter_id=$1 AND event_id=$2 AND lease_token=$3',[row.adapter_id,row.event_id,token]);completed++;
      }catch{
        const delay=Math.min(3600,5*2**Math.min(Number(row.attempts),10));
        await this.db.query("UPDATE provider_callback_inbox SET lease_until=NULL,lease_token=NULL,next_attempt_at=now()+($4 * interval '1 second'),diagnostic='provider_reconciliation_pending' WHERE adapter_id=$1 AND event_id=$2 AND lease_token=$3",[row.adapter_id,row.event_id,token,delay]);failed++;
      }
    }return {completed,failed};
  }
}
/** Periodic fallback queries only executions with a durable external receipt. No submit on a callback. */
export async function reconcileProviderReceipts(queue:GenerationQueue,productionIds:readonly string[],
  reconcile:(id:string)=>Promise<GenerationExecution>){
  let checked=0,pending=0;
  for(const productionId of new Set(productionIds))for(const execution of await queue.list(productionId)){
    if(!execution.provider_job?.external_job_id||!['active','unknown'].includes(execution.state))continue;
    try{const result=await reconcile(execution.id);checked++;if(result.state==='unknown')pending++;}catch{pending++;}
  }return {checked,pending};
}
/** Query settled receipts for final invoice corrections/refunds. This path never submits/cancels generation. */
export async function reconcileSettledInvoices(queue:GenerationQueue&{reconcileBilling(id:string,job:unknown):Promise<GenerationExecution>},
  adapters:ReadonlyMap<string,GenerationAdapter>,productionIds:readonly string[],admitQuery:(execution:GenerationExecution)=>Promise<boolean>,limit=100){
  if(!Number.isInteger(limit)||limit<1||limit>1000)throw new Error('provider_billing_limit_invalid');
  let checked=0,pending=0;
  for(const productionId of new Set(productionIds))for(const execution of await queue.list(productionId)){
    if(checked+pending>=limit)return {checked,pending};
    if(!['succeeded','failed','cancelled'].includes(execution.state)||!execution.provider_job?.external_job_id)continue;
    const adapter=adapters.get(execution.intent.adapter_id);if(!adapter)continue;
    try{
      const caps=await adapter.capabilities();if(caps.mode!=='real')continue;
      if(caps.adapter_id!==execution.intent.adapter_id||!caps.can_query_job||!caps.evidence_refs.length||!await admitQuery(execution)){pending++;continue;}
      const result=AdapterResultSchema.parse(await adapter.query(execution.provider_job.external_job_id));
      if(result.outcome!=='accepted'){pending++;continue;}
      await queue.reconcileBilling(execution.id,result.job);checked++;
    }catch{pending++;}
  }return {checked,pending};
}
