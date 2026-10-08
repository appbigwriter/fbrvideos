import {AdapterCapabilitiesSchema,type AssetStore,type GenerationAdmission,type GenerationExecution} from '@fbr/contracts';
import type {SqlDatabase} from './configuration-store.js';
import {ProductionPipeline,type PipelineBindings} from './production-pipeline.js';
import {SyntheticMediaAdapter} from './synthetic-media-adapter.js';
import {PostgresGenerationQueue} from './generation-queue.js';
import {PostgresReviewWorkflow} from './review-workflow.js';
import type {ProviderRuntime} from './provider-runtime.js';
import {createRealPipelineBindings,type RealPipelineConfig} from './real-pipeline-bindings.js';
import {ProviderCallbackInbox,reconcileSettledInvoices} from './provider-callback-inbox.js';
import {GenerationWorker} from '@fbr/pipeline';

/** Composição concreta compartilhada entre API e worker, com política real explícita. */
export async function createRuntimeFromBindings(context:{db:SqlDatabase;files:AssetStore},bindings:PipelineBindings,policy:{admission:GenerationAdmission;admitReal:(execution:GenerationExecution)=>Promise<boolean>},quality:import('./assembly-service.js').AssemblyQualityOptions={}):Promise<ProviderRuntime>{
  const adapters=new Map();for(const binding of Object.values(bindings)){const caps=AdapterCapabilitiesSchema.parse(await binding.adapter.capabilities());adapters.set(caps.adapter_id,binding.adapter);}
  const queue=new PostgresGenerationQueue(context.db,policy.admission),review=new PostgresReviewWorkflow(context.db,context.files,policy.admission),pipeline=new ProductionPipeline(context.db,context.files,bindings,queue,review,quality);
  return{files:context.files,adapters,...policy,pipeline,prepareCorrection:id=>pipeline.prepareCorrection(id),advance:id=>pipeline.advance(id),recover:()=>pipeline.recover(),canExecute:execution=>pipeline.canExecute(execution)};
}
export async function createRealProviderRuntime(config:RealPipelineConfig,context:{db:SqlDatabase;files:AssetStore}):Promise<ProviderRuntime>{
  const configured=await createRealPipelineBindings(config,context),runtime=await createRuntimeFromBindings(context,configured.bindings,configured,config.assembly_quality),queue=new PostgresGenerationQueue(context.db,configured.admission),worker=new GenerationWorker(queue,runtime.adapters,configured.admitReal);
  const inbox=new ProviderCallbackInbox(context.db,queue,async signal=>runtime.adapters.has(signal.adapter_id));
  const reconcile=async(id:string)=>{const execution=await queue.get(id);if(!execution)throw new Error('callback_execution_missing');
    if(['succeeded','failed','cancelled'].includes(execution.state)&&execution.provider_job?.external_job_id){
      if(!await configured.admitReal(execution))throw new Error('callback_account_not_admitted');
      const result=await runtime.adapters.get(execution.intent.adapter_id)!.query(execution.provider_job.external_job_id);
      if(result.outcome!=='accepted')throw new Error('callback_query_blocked');return queue.reconcileBilling(id,result.job);
    }return worker.reconcileCallback(id);};
  if(config.decodeAuthenticatedCallback)runtime.receiveCallback=async(adapterId,body,headers)=>{
    const signal=await config.decodeAuthenticatedCallback!(adapterId,body,headers);
    if(signal.adapter_id!==adapterId)throw new Error('callback_adapter_mismatch');return inbox.receive(signal);
  };
  let lastInvoices=0;
  let invoiceCursor='';
  runtime.recover=async()=>{
    const callbacks=await inbox.drain(reconcile),pipeline=await runtime.pipeline!.recover();
    if(Date.now()-lastInvoices<300000)return{callbacks,pipeline};lastInvoices=Date.now();
    let invoices={checked:0,pending:0},scannedProductions=0;
    for(;;){const rows=(await context.db.query('SELECT DISTINCT production_id FROM generation_heads WHERE production_id>$1 ORDER BY production_id LIMIT 100',[invoiceCursor])).rows;
      if(!rows.length){invoiceCursor='';break;}
      for(const row of rows){invoiceCursor=String(row.production_id);const batch=await reconcileSettledInvoices(queue,runtime.adapters,[invoiceCursor],configured.admitReal,1000);invoices.checked+=batch.checked;invoices.pending+=batch.pending;}
      if(rows.length<100){invoiceCursor='';break;}
      scannedProductions+=rows.length;if(invoices.checked+invoices.pending>=1000||scannedProductions>=1000)break;
    }return{callbacks,pipeline,invoices};
  };return runtime;
}
/** Módulo carregável em FBR_PROVIDER_BINDINGS_MODULE para ensaio local explícito. */
export async function createProviderRuntime(context:{db:SqlDatabase;files:AssetStore}):Promise<ProviderRuntime>{
  if(process.env.FBR_GENERATION_MODE!=='synthetic')throw new Error('synthetic_runtime_requires_explicit_mode');
  const bindings:PipelineBindings={};for(const operation of ['audio','image','animation','avatar'] as const){const adapter=new SyntheticMediaAdapter(context.db,context.files,operation);
    bindings[operation]={adapter,outputs:adapter,estimate:async context=>({currency:context.production.costs.currency,upper_minor:0,evidence:'Ensaio sintético local, sem chamada externa ou cobrança.'})};}
  return createRuntimeFromBindings(context,bindings,{admission:async()=>false,admitReal:async()=>false});
}
