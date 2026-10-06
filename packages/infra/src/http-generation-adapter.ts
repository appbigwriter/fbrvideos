import {AdapterCapabilitiesSchema,AdapterRequestSchema,AdapterResultSchema,type AdapterRequest,type AdapterResult,
  type AdapterCapabilities,type GenerationAdapter} from '@fbr/contracts';
import {z} from 'zod';
import {canonical,sha256} from '@fbr/domain';
import type {SqlDatabase} from './configuration-store.js';
export interface HttpTransmissionJournal{pin(adapterId:string,request:AdapterRequest,payload:unknown):Promise<void>}
export class PostgresHttpTransmissionJournal implements HttpTransmissionJournal{
  constructor(private readonly db:SqlDatabase){}
  async pin(adapterId:string,request:AdapterRequest,raw:unknown){
    const payload=z.json().parse(raw),fingerprint=sha256(canonical(payload));
    await this.db.transaction(async client=>{
      await client.query('INSERT INTO provider_http_intents(adapter_id,execution_key,attempt,production_id,fingerprint,record) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT DO NOTHING',
        [adapterId,request.execution_key,request.attempt,request.production.id,fingerprint,JSON.stringify(payload)]);
      const old=(await client.query('SELECT production_id,fingerprint FROM provider_http_intents WHERE adapter_id=$1 AND execution_key=$2 AND attempt=$3',[adapterId,request.execution_key,request.attempt])).rows[0];
      if(!old||old.production_id!==request.production.id||old.fingerprint!==fingerprint)throw new Error('provider_http_intention_changed');
    });
  }
}

export interface ProviderHttpBinding{
  capabilities:AdapterCapabilities;
  origin:string;
  account_scope:string;
  headers():Record<string,string>;
  validate(request:AdapterRequest):Promise<void>;
  submit(request:AdapterRequest):{path:string;body:unknown};
  query(externalId:string):string;
  cancel(externalId:string):string;
  decode(payload:unknown,context:{request:AdapterRequest|null;external_id:string|null}):Promise<AdapterResult>;
}
/** Mapeamento específico do fornecedor é injetado; nenhum endpoint/custo é presumido. */
export class HttpGenerationAdapter implements GenerationAdapter{
  private readonly caps:AdapterCapabilities;
  private readonly origin:URL;
  constructor(private readonly binding:ProviderHttpBinding,private readonly request:typeof fetch=fetch,private readonly journal?:HttpTransmissionJournal){
    this.caps=AdapterCapabilitiesSchema.parse(binding.capabilities);this.origin=new URL(binding.origin);
    if(this.caps.mode!=='real'||!binding.account_scope.trim()||this.origin.protocol!=='https:'||this.origin.username||this.origin.password||this.origin.pathname!=='/'||this.origin.search||this.origin.hash
      ||(this.caps.supports_idempotent_recovery&&!journal))
      throw new Error('provider_binding_invalid');
  }
  async capabilities(){return this.caps;}
  private async call(path:string,method:'POST'|'GET',body:unknown,context:{request:AdapterRequest|null;external_id:string|null}){
    const url=new URL(path,this.origin);
    if(url.origin!==this.origin.origin||url.username||url.password||url.hash)throw new Error('provider_url_outside_origin');
    const headers=new Headers(this.binding.headers());headers.set('Accept','application/json');
    if(body!==undefined)headers.set('Content-Type','application/json');
    if(context.request)headers.set('Idempotency-Key',`${context.request.execution_key}:${context.request.attempt}`);
    const response=await this.request(url,{method,headers,redirect:'error',signal:AbortSignal.timeout(15000),
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!response.ok)throw new Error('provider_http_failure');
    if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('provider_response_type_invalid');
    const reader=response.body?.getReader();if(!reader)throw new Error('provider_response_empty');
    const chunks:Uint8Array[]= [];let count=0;
    try{for(;;){const part=await reader.read();if(part.done)break;count+=part.value.byteLength;
      if(count>1_000_000)throw new Error('provider_response_too_large');chunks.push(part.value);}}
    finally{await reader.cancel();}
    const payload=JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    return AdapterResultSchema.parse(await this.binding.decode(payload,context));
  }
  async submit(raw:AdapterRequest){
    const request=AdapterRequestSchema.parse(raw);
    if(!this.caps.operations.includes(request.operation)||(request.route&&!this.caps.routes.includes(request.route))
      ||Object.keys(request.parameters).some(field=>!this.caps.supported_fields.includes(field))
      ||(request.references.length&&!this.caps.accepts_references)
      ||(request.operation==='avatar'&&(!this.caps.accepts_official_audio||!request.input_assets.length)))throw new Error('provider_capability_missing');
    await this.binding.validate(request);
    const mapped=this.binding.submit(request);
    if(this.journal)await this.journal.pin(this.caps.adapter_id,request,{origin:this.origin.origin,account_scope:this.binding.account_scope,path:mapped.path,body:z.json().parse(mapped.body)});
    return this.call(mapped.path,'POST',mapped.body,{request,external_id:null});
  }
  async query(externalId:string){if(!this.caps.can_query_job)throw new Error('provider_query_unsupported');return this.call(this.binding.query(externalId),'GET',undefined,{request:null,external_id:externalId});}
  async recover(request:AdapterRequest){
    if(!this.caps.supports_idempotent_recovery||!this.caps.evidence_refs.length)throw new Error('provider_idempotent_recovery_unsupported');
    return this.submit(request);
  }
  async cancel(externalId:string){if(!this.caps.can_cancel_job)throw new Error('provider_cancel_unsupported');return this.call(this.binding.cancel(externalId),'POST',undefined,{request:null,external_id:externalId});}
}
