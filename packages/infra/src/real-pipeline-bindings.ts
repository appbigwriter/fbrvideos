import {AdapterCapabilitiesSchema,AssetSchema,GenerationExecutionSchema,type AdapterRequest,type Asset,type AssetStore,
  type GenerationAdmission,type GenerationExecution,type GenerationIntent,type ModelOperation,type Production,type VersionRef} from '@fbr/contracts';
import {canonical,sha256,sameRef} from '@fbr/domain';
import {z} from 'zod';
import type {SqlDatabase} from './configuration-store.js';
import type {PipelineBindings,PipelineOperationContext} from './production-pipeline.js';
import {pipelineState} from './production-pipeline.js';
import {createHiggsfieldAdapter,createHeygenAdapter,PostgresProviderReceiptStore,type ProviderBillingResolver,type ProviderOutputDescriptor} from './normalized-provider-adapters.js';
import {PostgresHttpTransmissionJournal} from './http-generation-adapter.js';
import {HiggsfieldClient} from './higgsfield-client.js';
import {HeygenClient} from './heygen-client.js';
import {ProviderMediaTransfer,type MediaTransferTransport} from './provider-media-transfer.js';
import {probeLocalMedia} from './media-probe.js';
import {ProviderQuoteSchema,validateProviderQuote,type ProviderQuote} from './provider-estimates.js';
import {belongsToExecution} from './asset-provenance.js';

type Operation='audio'|'image'|'animation'|'avatar';
export interface RealPipelineOperationConfig {
  vendor:'higgsfield'|'heygen';adapter_id:string;model:ModelOperation;account_scope:string;enabled:boolean;
  key():string;evidence_refs:string[];
  /** Explicit server-side account/spending gate, never inferred from fixtures. */
  authorize(production:Production):Promise<boolean>;
  parameters(context:PipelineOperationContext):Promise<AdapterRequest['parameters']>;
  quote(request:AdapterRequest):Promise<ProviderQuote>;
  /** Upload/sign approved owned inputs and return provider fields; invoked only on actual submit. */
  prepareParameters(request:AdapterRequest,inputs:Asset[],files:AssetStore):Promise<AdapterRequest['parameters']>;
  billing:ProviderBillingResolver;
  outputUrls?:(payload:unknown)=>string[];
  usage?:ProviderOutputDescriptor['usage'];
  idempotent_recovery_verified?:boolean;
  input_url_fields?:('audio_url'|'image_url'|'end_image_url')[];
}
export interface RealPipelineConfig {operations:Partial<Record<Operation,RealPipelineOperationConfig>>;media_origins:string[];
  network?:typeof fetch;media_transport?:MediaTransferTransport}

/** Concrete composition with local durable journals. Construction performs no provider requests. */
export async function createRealPipelineBindings(config:RealPipelineConfig,context:{db:SqlDatabase;files:AssetStore}){
  const {db,files}=context,bindings:PipelineBindings={},receipts=new PostgresProviderReceiptStore(db),journal=new PostgresHttpTransmissionJournal(db);
  const transfer=new ProviderMediaTransfer(config.media_origins,config.media_transport);
  const routes=new Map<string,RealPipelineOperationConfig>();
  const quoteKey=(intent:GenerationIntent)=>[intent.adapter_id,intent.request.execution_key,intent.request.attempt];
  const verifyQuote=async(intent:GenerationIntent)=>{
    const route=routes.get(intent.adapter_id);if(!route?.enabled)throw new Error('real_pipeline_route_closed');
    const row=(await db.query('SELECT record FROM provider_quotes WHERE adapter_id=$1 AND execution_key=$2 AND attempt=$3',quoteKey(intent))).rows[0];
    validateProviderQuote(row?.record,intent,route.account_scope);
  };
  async function ownedInputs(request:AdapterRequest){
    const {d}=await pipelineState(db,request.production.id);
    const dependencies=z.object({requires:z.array(z.string())}).parse(request.parameters['_fbr']).requires;
    const executions=(await db.query('SELECT r.record FROM generation_revisions r JOIN generation_heads h USING(id,version) WHERE h.production_id=$1',[request.production.id])).rows.map(row=>GenerationExecutionSchema.parse(row.record));
    const refs:VersionRef[]=[...request.input_assets];
    for(const key of dependencies){const execution=executions.filter(e=>e.intent.request.execution_key===key).sort((a,b)=>b.intent.request.attempt-a.intent.request.attempt)[0];
      if(execution?.state!=='succeeded'||!execution.provider_job)throw new Error('real_pipeline_dependency_pending');
      for(const output of execution.provider_job.output_assets){const approved=d.assets.find(a=>a.id===output.id&&a.status==='approved');
        if(!approved)throw new Error('real_pipeline_dependency_not_approved');refs.push({id:approved.id,version:approved.version});}
    }
    const assets:Asset[]=[];
    for(const assetRef of refs){if(assets.some(a=>sameRef(a,assetRef)))continue;
      const approved=d.assets.find(a=>sameRef(a,assetRef)&&a.status==='approved'&&a.usage.permission==='allowed');
      const owned=(await db.query("SELECT r.record FROM media_revisions r JOIN media_heads h USING(kind,id) WHERE r.kind='asset' AND r.id=$1 AND r.version=$2 AND h.production_id=$3",[assetRef.id,assetRef.version,request.production.id])).rows[0];
      if(!approved||!owned||canonical(AssetSchema.parse(owned.record))!==canonical(approved)||!await files.exists(approved))throw new Error('real_pipeline_input_not_owned');
      if(approved.execution){const execution=executions.find(e=>e.provider_job?.id===approved.execution?.id);
        if(!execution||!await belongsToExecution(db,request.production.id,approved,execution))throw new Error('real_pipeline_input_lineage_invalid');
      }
      assets.push(approved);
    }
    if(request.operation==='avatar'&&!assets.some(a=>a.type==='audio'))throw new Error('real_pipeline_official_audio_missing');
    if(request.operation==='animation'&&!assets.some(a=>a.type==='image'))throw new Error('real_pipeline_initial_image_missing');
    return assets;
  }
  for(const [operation,route] of Object.entries(config.operations) as [Operation,RealPipelineOperationConfig][]){
    if(!route.enabled)continue;
    if(route.model.operation!==operation||route.model.documentation!=='schema_reviewed'||!route.account_scope.trim()||!route.evidence_refs.length
      ||(route.vendor==='higgsfield'&&!['image','animation'].includes(operation))||(route.vendor==='heygen'&&!['audio','avatar'].includes(operation))
      ||(route.vendor==='higgsfield'&&!route.outputUrls))throw new Error('real_pipeline_route_invalid');
    const caps=AdapterCapabilitiesSchema.parse({adapter_id:route.adapter_id,mode:'real',version:'1',operations:[operation],routes:route.model.route?[route.model.route]:[],
      accepts_official_audio:route.model.official_audio==='supported',produces_audio:operation==='audio',accepts_references:route.model.references==='supported',
      accepts_composition:route.model.composition==='supported',can_query_job:true,can_cancel_job:route.vendor==='higgsfield',max_clip_seconds:route.model.maximum_seconds,
      supported_fields:route.model.parameters.map(p=>p.name),evidence_refs:route.evidence_refs,supports_idempotent_recovery:route.vendor==='higgsfield'&&route.idempotent_recovery_verified===true});
    if(routes.has(route.adapter_id))throw new Error('real_pipeline_adapter_id_repeated');routes.set(route.adapter_id,route);
    const normalizedConfig={capabilities:caps,model:route.model,receipts,journal,account_scope:route.account_scope,billing:route.billing,
      input_url_fields:route.input_url_fields??[],
      ...(route.usage?{usage:route.usage}:{}),
      async download(url:string){const measured=await transfer.download(url,files,bytes=>probeLocalMedia(bytes,operation==='audio'?'audio':operation==='image'?'image':'clip'));return files.read(measured.storage_key);},
      async resolveInputAssets(request:AdapterRequest){return (await ownedInputs(request)).map(a=>({id:a.id,version:a.version}));},
      async prepareParameters(request:AdapterRequest){return route.prepareParameters(request,await ownedInputs(request),files);}};
    const adapter=route.vendor==='higgsfield'?createHiggsfieldAdapter(normalizedConfig,new HiggsfieldClient(route.key,config.network),route.outputUrls!)
      :createHeygenAdapter(normalizedConfig,new HeygenClient(route.key,config.network));
    const parameters=async(ctx:PipelineOperationContext)=>route.parameters(ctx);
    bindings[operation]={adapter,outputs:adapter,parameters,
      async estimate(ctx){
        if(!await route.authorize(ctx.production))throw new Error('real_pipeline_spending_not_authorized');
        const publicParameters=await parameters(ctx),allParameters=z.record(z.string(),z.json()).parse({...publicParameters,_fbr:ctx.step});
        const references=operation==='audio'?(ctx.snapshot.profile.voice?[ctx.snapshot.profile.voice]:[]):ctx.shot?
          Object.values(ctx.dossier.shots.find(s=>sameRef(s,ctx.shot!))!.references).flat().filter((v):v is VersionRef=>!!v):[];
        const shot=ctx.shot?ctx.dossier.shots.find(s=>sameRef(s,ctx.shot!)):null;
        const input_assets=operation==='avatar'?ctx.inputs.filter(a=>a.type==='audio'&&shot?.speech_segment_ids.some(id=>a.changes.some(c=>c.reason===`pipeline_speech:${id}`))).map(a=>({id:a.id,version:a.version})):operation==='animation'?
          ctx.inputs.filter(a=>a.type==='image'&&ctx.shot&&sameRef(a.specification,ctx.shot)).map(a=>({id:a.id,version:a.version})):[];
        const draft:AdapterRequest={contract_version:'0.1.0',execution_key:ctx.step.step,attempt:ctx.attempt??1,production:{id:ctx.production.id,version:ctx.production.version},shot:ctx.shot,
          operation,route:operation==='audio'?null:operation==='image'?'still_image':operation==='avatar'?'avatar':'animated_scene',input_assets,references,
          configuration_hash:sha256(canonical({adapter:caps.adapter_id,version:caps.version,parameters:publicParameters,step:ctx.step,profile:ctx.dossier.profile})),
          parameters:allParameters,currency:ctx.production.costs.currency,reserved_minor:0};
        const quote=ProviderQuoteSchema.parse(await route.quote(draft));
        const intent:GenerationIntent={adapter_id:route.adapter_id,request:{...draft,reserved_minor:quote.upper_minor},estimate:{currency:quote.currency,upper_minor:quote.upper_minor,evidence:quote.evidence}};
        validateProviderQuote(quote,intent,route.account_scope);
        const old=(await db.query('SELECT record FROM provider_quotes WHERE adapter_id=$1 AND execution_key=$2 AND attempt=$3',[route.adapter_id,draft.execution_key,draft.attempt])).rows[0];
        if(old){const prior=ProviderQuoteSchema.parse(old.record);
          if(prior.request_hash!==quote.request_hash||prior.currency!==quote.currency||prior.upper_minor!==quote.upper_minor||prior.account_scope!==quote.account_scope){
            const reserved=(await db.query('SELECT 1 FROM generation_heads WHERE execution_key=$1 AND attempt=$2',[draft.execution_key,draft.attempt])).rows.length;
            if(reserved)throw new Error('provider_quote_reserved_intention_changed');
          }
        }
        await db.query('INSERT INTO provider_quotes(adapter_id,execution_key,attempt,record) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(adapter_id,execution_key,attempt) DO UPDATE SET record=excluded.record',
          [route.adapter_id,draft.execution_key,draft.attempt,JSON.stringify(quote)]);
        return intent.estimate;
      },
      validateIntent:verifyQuote,
    };
  }
  const admission:GenerationAdmission=async(intent,production)=>{try{const route=routes.get(intent.adapter_id);return !!route&&await route.authorize(production)&&!!await verifyQuote(intent).then(()=>true);}catch{return false;}};
  async function admitReal(execution:GenerationExecution){const route=routes.get(execution.intent.adapter_id);if(!route?.enabled)return false;
    // Status/billing queries don't authorize another purchase; recovery/submission still requires a valid quote and spending gate.
    if(execution.provider_job?.external_job_id)return true;
    const {p}=await pipelineState(db,execution.intent.request.production.id);return admission(execution.intent,p);
  }
  return {bindings,admission,admitReal};
}
