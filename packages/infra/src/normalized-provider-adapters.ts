import {AdapterCapabilitiesSchema,AdapterRequestSchema,JobSchema,type AdapterCapabilities,type AdapterRequest,type AdapterResult,
  type GenerationAdapter,type GenerationExecution,type Job,type ModelOperation} from '@fbr/contracts';
import {canonical,sha256} from '@fbr/domain';
import type {SqlDatabase} from './configuration-store.js';
import {HiggsfieldClient,type HiggsfieldReceipt} from './higgsfield-client.js';
import {HeygenClient} from './heygen-client.js';
import type {HttpTransmissionJournal} from './http-generation-adapter.js';
import {z} from 'zod';

export interface ProviderOutputDescriptor {id:string;url:string;usage:{permission:'unknown'|'allowed'|'denied';evidence:string|null}}
export interface ProviderObservation {status:Job['status'];outputs:ProviderOutputDescriptor[];error?:string}
export interface ProviderReceiptRecord {account_scope:string;request:AdapterRequest;receipt:unknown;job:Job;outputs:ProviderOutputDescriptor[];
  billing:{currency:string;confirmed_minor:number;evidence:string}|null;
  billing_history:{at:string;currency:string;confirmed_minor:number;evidence:string}[]}
export interface ProviderReceiptStore {
  get(adapterId:string,externalId:string):Promise<ProviderReceiptRecord|null>;
  find(adapterId:string,key:string,attempt:number):Promise<ProviderReceiptRecord|null>;
  save(adapterId:string,externalId:string,update:(previous:ProviderReceiptRecord|null)=>ProviderReceiptRecord):Promise<ProviderReceiptRecord>;
}
export class PostgresProviderReceiptStore implements ProviderReceiptStore {
  constructor(private readonly db:SqlDatabase){}
  async get(adapterId:string,externalId:string){const row=(await this.db.query('SELECT record FROM provider_normalized_receipts WHERE adapter_id=$1 AND external_id=$2',[adapterId,externalId])).rows[0];return row?row.record as ProviderReceiptRecord:null;}
  async find(adapterId:string,key:string,attempt:number){const row=(await this.db.query('SELECT record FROM provider_normalized_receipts WHERE adapter_id=$1 AND execution_key=$2 AND attempt=$3',[adapterId,key,attempt])).rows[0];return row?row.record as ProviderReceiptRecord:null;}
  async save(adapterId:string,externalId:string,update:(previous:ProviderReceiptRecord|null)=>ProviderReceiptRecord){return this.db.transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`provider-receipt:${adapterId}:${externalId}`]);
    const row=(await client.query('SELECT record FROM provider_normalized_receipts WHERE adapter_id=$1 AND external_id=$2 FOR UPDATE',[adapterId,externalId])).rows[0];
    const previous=row?row.record as ProviderReceiptRecord:null,next=update(previous);JobSchema.parse(next.job);AdapterRequestSchema.parse(next.request);
    if(previous&&canonical(previous.request)!==canonical(next.request))throw new Error('provider_receipt_intention_changed');
    await client.query('INSERT INTO provider_normalized_receipts(adapter_id,external_id,execution_key,attempt,record) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(adapter_id,external_id) DO UPDATE SET record=excluded.record',
      [adapterId,externalId,next.request.execution_key,next.request.attempt,JSON.stringify(next)]);return next;
  });}
}

/** Billing is independent of generation completion. null always preserves reservation. */
export interface ProviderBillingResolver {resolve(context:{adapter_id:string;external_id:string;request:AdapterRequest;receipt:unknown}):Promise<{currency:string;confirmed_minor:number;evidence:string}|null>}
export interface NormalizedProviderConfig {
  capabilities:AdapterCapabilities;model:ModelOperation;receipts:ProviderReceiptStore;journal:HttpTransmissionJournal;account_scope:string;
  billing?:ProviderBillingResolver;
  prepareParameters?:(request:AdapterRequest)=>Promise<AdapterRequest['parameters']>;
  resolveInputAssets?:(request:AdapterRequest)=>Promise<AdapterRequest['input_assets']>;
  input_url_fields?:('audio_url'|'image_url'|'end_image_url')[];
  download(url:string):Promise<Uint8Array>;
  usage?:ProviderOutputDescriptor['usage'];
}
interface ProviderProtocol {
  submit(request:AdapterRequest):Promise<{external_id:string;receipt:unknown;observation:ProviderObservation}>;
  query(record:ProviderReceiptRecord):Promise<ProviderObservation>;
  cancel?:((record:ProviderReceiptRecord)=>Promise<ProviderObservation>);
}
export class NormalizedProviderAdapter implements GenerationAdapter {
  private readonly caps:AdapterCapabilities;
  constructor(private readonly config:NormalizedProviderConfig,private readonly protocol:ProviderProtocol){
    this.caps=AdapterCapabilitiesSchema.parse(config.capabilities);
    if(this.caps.mode!=='real'||!this.caps.operations.includes(config.model.operation)||!this.caps.can_query_job
      ||this.caps.can_cancel_job!==!!protocol.cancel||!this.caps.evidence_refs.length||!config.account_scope.trim())throw new Error('normalized_provider_configuration_invalid');
  }
  async capabilities(){return this.caps;}
  private async publish(externalId:string,request:AdapterRequest,receipt:unknown,observation:ProviderObservation){
    // Billing outage must never discard a generation receipt and make the send ambiguous.
    let billing:ProviderReceiptRecord['billing']=null;
    try{billing=await this.config.billing?.resolve({adapter_id:this.caps.adapter_id,external_id:externalId,request,receipt})??null;}catch{billing=null;}
    if(billing&&(billing.currency!==request.currency||!Number.isSafeInteger(billing.confirmed_minor)||billing.confirmed_minor<0||!billing.evidence.trim()))billing=null;
    const result=await this.config.receipts.save(this.caps.adapter_id,externalId,previous=>{
      if(previous&&(canonical(previous.request)!==canonical(request)||previous.account_scope!==this.config.account_scope))throw new Error('provider_receipt_intention_changed');
      const prior=previous?.job;
      const terminal=prior&&['succeeded','failed','cancelled'].includes(prior.status);
      if(terminal&&prior.status!==observation.status)throw new Error('provider_terminal_state_changed');
      if(previous?.outputs.length&&canonical(previous.outputs.map(o=>o.id))!==canonical(observation.outputs.map(o=>o.id)))throw new Error('provider_output_identity_changed');
      const outputs=observation.outputs;
      const at=prior?.created_at??new Date().toISOString();
      const job=JobSchema.parse({id:prior?.id??`job_${sha256(`${this.caps.adapter_id}:${request.execution_key}:${request.attempt}`).slice(0,32)}`,
        version:prior?.version??1,created_at:at,author:this.caps.adapter_id,changes:prior?.changes??[],status:observation.status,
        production:request.production,stage:request.operation,provider:this.caps.adapter_id,model:this.config.model.model,external_job_id:externalId,
        execution_key:request.execution_key,attempt:request.attempt,inputs:request.input_assets,configuration_hash:request.configuration_hash,
        sent_parameters:request.parameters,unsupported_fields:[],output_assets:outputs.map(o=>({id:o.id,version:1})),
        costs:{currency:request.currency,estimated_minor:request.reserved_minor,committed_minor:request.reserved_minor,confirmed_minor:billing?.confirmed_minor??prior?.costs.confirmed_minor??null},
        error:observation.status==='failed'?{code:'provider_unavailable',message:observation.error??'Provider generation failed.',retryable:false,correlation_id:request.execution_key,issues:[]}:null});
      if(prior&&canonical(job)!==canonical(prior)){job.version=prior.version+1;job.changes=[...prior.changes,{at:new Date().toISOString(),author:this.caps.adapter_id,reason:'Authenticated provider reconciliation'}];}
      const history=previous?.billing_history??[];
      const billing_history=billing&&canonical(billing)!==canonical(previous?.billing??null)?[...history,{at:new Date().toISOString(),...billing}]:history;
      return {account_scope:this.config.account_scope,request,receipt,job,outputs,billing:billing??previous?.billing??null,billing_history};
    });return {outcome:'accepted' as const,job:result.job};
  }
  async submit(raw:AdapterRequest):Promise<AdapterResult>{
    const request=AdapterRequestSchema.parse(raw);
    if(!this.caps.operations.includes(request.operation)||request.operation!==this.config.model.operation
      ||(request.route&&!this.caps.routes.includes(request.route))||Object.keys(request.parameters).some(k=>k!=='_fbr'&&!this.caps.supported_fields.includes(k))
      ||(request.references.length&&!this.caps.accepts_references)||request.operation==='avatar'&&(!this.caps.accepts_official_audio||(!request.input_assets.length&&!this.config.resolveInputAssets)))throw new Error('provider_capability_missing');
    const existing=await this.config.receipts.find(this.caps.adapter_id,request.execution_key,request.attempt);
    if(existing){if(canonical(existing.request)!==canonical(request)||existing.account_scope!==this.config.account_scope)throw new Error('provider_receipt_intention_changed');return this.query(existing.job.external_job_id!);}
    const {_fbr:_internal,...publicParameters}=request.parameters;
    const input_assets=this.config.resolveInputAssets?await this.config.resolveInputAssets(request):request.input_assets;
    const parameters=z.record(z.string(),z.json()).parse(this.config.prepareParameters?await this.config.prepareParameters(request):publicParameters);
    if('_fbr' in parameters||Object.keys(parameters).some(k=>!this.caps.supported_fields.includes(k)))throw new Error('provider_prepared_parameters_invalid');
    const inputFields=new Set(this.config.input_url_fields??[]);
    for(const key of new Set([...Object.keys(parameters),...Object.keys(publicParameters)])){
      if(Object.hasOwn(parameters,key)===Object.hasOwn(publicParameters,key)&&canonical(parameters[key]??null)===canonical(publicParameters[key]??null))continue;
      if(!inputFields.has(key as 'audio_url'|'image_url'|'end_image_url')||!input_assets.length||typeof parameters[key]!=='string')throw new Error('provider_quoted_parameters_changed');
      const url=new URL(parameters[key] as string);if(url.protocol!=='https:'||url.username||url.password)throw new Error('provider_input_url_invalid');
    }
    if(request.operation==='avatar'&&!input_assets.length)throw new Error('provider_official_audio_missing');
    await this.config.journal.pin(this.caps.adapter_id,request,{account_scope:this.config.account_scope,model:this.config.model.model,parameters,input_assets});
    const response=await this.protocol.submit({...request,parameters,input_assets});return this.publish(response.external_id,request,response.receipt,response.observation);
  }
  async query(externalId:string):Promise<AdapterResult>{const record=await this.config.receipts.get(this.caps.adapter_id,externalId);if(!record||record.account_scope!==this.config.account_scope)throw new Error('provider_receipt_missing');return this.publish(externalId,record.request,record.receipt,await this.protocol.query(record));}
  async recover(request:AdapterRequest){if(!this.caps.supports_idempotent_recovery)throw new Error('provider_recovery_unsupported');return this.submit(request);}
  async cancel(externalId:string){const record=await this.config.receipts.get(this.caps.adapter_id,externalId);if(!record||record.account_scope!==this.config.account_scope||!this.protocol.cancel)throw new Error('provider_cancel_unsupported');return this.publish(externalId,record.request,record.receipt,await this.protocol.cancel(record));}
  async resolve(execution:GenerationExecution){
    const job=execution.provider_job;if(!job||job.status!=='succeeded'||execution.intent.adapter_id!==this.caps.adapter_id||!job.external_job_id)throw new Error('provider_outputs_not_ready');
    const record=await this.config.receipts.get(this.caps.adapter_id,job.external_job_id);
    if(!record||record.account_scope!==this.config.account_scope||record.job.id!==job.id||record.request.configuration_hash!==job.configuration_hash||record.request.execution_key!==job.execution_key
      ||record.request.attempt!==job.attempt||canonical(record.request.production)!==canonical(job.production)
      ||canonical(record.outputs.map(o=>({id:o.id,version:1})))!==canonical(job.output_assets))throw new Error('provider_output_provenance_mismatch');
    return Promise.all(record.outputs.map(async output=>({id:output.id,bytes:await this.config.download(output.url),usage:output.usage})));
  }
}

function descriptor(config:NormalizedProviderConfig,key:string,index:number,url:string):ProviderOutputDescriptor{
  const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw new Error('provider_output_url_invalid');
  return {id:`asset_${sha256(`${config.capabilities.adapter_id}:${key}:${index}`).slice(0,32)}`,url,usage:config.usage??{permission:'unknown',evidence:null}};
}
export function createHiggsfieldAdapter(config:NormalizedProviderConfig,client:HiggsfieldClient,
  outputs:(payload:unknown)=>string[]){
  function observation(payload:unknown,receipt:HiggsfieldReceipt):ProviderObservation{
    const status=(payload as {status?:string}).status;
    const mapping:Record<string,Job['status']>={queued:'queued',in_progress:'running',completed:'succeeded',failed:'failed',nsfw:'failed',canceled:'cancelled'};
    if(!status||!mapping[status])throw new Error('higgsfield_status_unknown');
    const urls=status==='completed'?outputs(payload):[];if(status==='completed'&&!urls.length)throw new Error('higgsfield_outputs_missing');
    return {status:mapping[status]!,outputs:urls.map((url,i)=>descriptor(config,receipt.request_id,i,url)),...(status==='failed'||status==='nsfw'?{error:'Higgsfield rejected or failed generation.'}:{})};
  }
  return new NormalizedProviderAdapter(config,{
    async submit(request){const receipt=await client.submit(config.model,request);return {external_id:receipt.request_id,receipt,
      observation:receipt.status==='completed'?{status:'unknown' as const,outputs:[]}:observation(receipt,receipt)};},
    async query(record){const receipt=record.receipt as HiggsfieldReceipt;return observation(await client.status(receipt),receipt);},
    async cancel(record){const receipt=record.receipt as HiggsfieldReceipt;return observation(await client.cancel(receipt),receipt);},
  });
}
export function createHeygenAdapter(config:NormalizedProviderConfig,client:HeygenClient){
  if(config.capabilities.supports_idempotent_recovery||config.capabilities.can_cancel_job)throw new Error('heygen_recovery_cancel_not_documented');
  const audio=config.model.operation==='audio';
  return new NormalizedProviderAdapter(config,{
    async submit(request){if(audio){const receipt=await client.synthesizeSpeech(config.model,request);return {external_id:receipt.request_id,receipt,observation:{status:'succeeded',outputs:[descriptor(config,receipt.request_id,0,receipt.audio_url)]}};}
      const receipt=await client.generateAvatar(config.model,request);return {external_id:receipt.video_id,receipt,observation:{status:'queued',outputs:[]}};},
    async query(record){if(audio)return {status:'succeeded',outputs:record.outputs};
      const result=await client.videoStatus(record.job.external_job_id!);
      const mapping:Record<string,Job['status']>={pending:'queued',waiting:'queued',processing:'running',completed:'succeeded',failed:'failed'};
      if(!mapping[result.status])throw new Error('heygen_status_unknown');
      if(result.status==='completed'&&!result.video_url)throw new Error('heygen_output_missing');
      return {status:mapping[result.status]!,outputs:result.video_url?[descriptor(config,result.id,0,result.video_url)]:[],...(result.status==='failed'?{error:'HeyGen generation failed.'}:{})};},
  });
}
