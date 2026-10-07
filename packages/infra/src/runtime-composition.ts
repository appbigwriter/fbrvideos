import {AdapterCapabilitiesSchema,type AssetStore,type GenerationAdmission,type GenerationExecution} from '@fbr/contracts';
import type {SqlDatabase} from './configuration-store.js';
import {ProductionPipeline,type PipelineBindings} from './production-pipeline.js';
import {SyntheticMediaAdapter} from './synthetic-media-adapter.js';
import {PostgresGenerationQueue} from './generation-queue.js';
import {PostgresReviewWorkflow} from './review-workflow.js';
import type {ProviderRuntime} from './provider-runtime.js';
import {createRealPipelineBindings,type RealPipelineConfig} from './real-pipeline-bindings.js';

/** Composição concreta compartilhada entre API e worker, com política real explícita. */
export async function createRuntimeFromBindings(context:{db:SqlDatabase;files:AssetStore},bindings:PipelineBindings,policy:{admission:GenerationAdmission;admitReal:(execution:GenerationExecution)=>Promise<boolean>}):Promise<ProviderRuntime>{
  const adapters=new Map();for(const binding of Object.values(bindings)){const caps=AdapterCapabilitiesSchema.parse(await binding.adapter.capabilities());adapters.set(caps.adapter_id,binding.adapter);}
  const queue=new PostgresGenerationQueue(context.db,policy.admission),review=new PostgresReviewWorkflow(context.db,context.files,policy.admission),pipeline=new ProductionPipeline(context.db,context.files,bindings,queue,review);
  return{files:context.files,adapters,...policy,pipeline,prepareCorrection:id=>pipeline.prepareCorrection(id),advance:id=>pipeline.advance(id),recover:()=>pipeline.recover(),canExecute:execution=>pipeline.canExecute(execution)};
}
export async function createRealProviderRuntime(config:RealPipelineConfig,context:{db:SqlDatabase;files:AssetStore}):Promise<ProviderRuntime>{
  const configured=await createRealPipelineBindings(config,context);return createRuntimeFromBindings(context,configured.bindings,configured);
}
/** Módulo carregável em FBR_PROVIDER_BINDINGS_MODULE para ensaio local explícito. */
export async function createProviderRuntime(context:{db:SqlDatabase;files:AssetStore}):Promise<ProviderRuntime>{
  if(process.env.FBR_GENERATION_MODE!=='synthetic')throw new Error('synthetic_runtime_requires_explicit_mode');
  const bindings:PipelineBindings={};for(const operation of ['audio','image','animation','avatar'] as const){const adapter=new SyntheticMediaAdapter(context.db,context.files,operation);
    bindings[operation]={adapter,outputs:adapter,estimate:async context=>({currency:context.production.costs.currency,upper_minor:0,evidence:'Ensaio sintético local, sem chamada externa ou cobrança.'})};}
  return createRuntimeFromBindings(context,bindings,{admission:async()=>false,admitReal:async()=>false});
}
