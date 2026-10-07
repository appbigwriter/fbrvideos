import {resolve,relative,isAbsolute,sep,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {realpath} from 'node:fs/promises';
import {AdapterCapabilitiesSchema,type AssetStore,type GenerationAdapter,type GenerationAdmission,type GenerationExecution} from '@fbr/contracts';
import type {SqlDatabase} from './configuration-store.js';
import type {ProductionPipeline} from './production-pipeline.js';
export interface ProviderRuntime{
  files?:AssetStore;
  adapters:ReadonlyMap<string,GenerationAdapter>;
  admission:GenerationAdmission;
  admitReal(execution:GenerationExecution):Promise<boolean>;
  prepareCorrection?(productionId:string):Promise<void>;
  advance?(productionId:string):Promise<void>;
  pipeline?:ProductionPipeline;
  recover?():Promise<unknown>;
  canExecute?(execution:GenerationExecution):Promise<boolean>;
}
/** Ponto único de composição para adicionar APIs depois, sem mudar fila, custos ou contratos do domínio. */
export async function loadProviderRuntime(path:string|undefined,context:{db:SqlDatabase;files:AssetStore}):Promise<ProviderRuntime|null>{
  if(!path?.trim())return null;
  const root=resolve(process.cwd()),target=resolve(root,path),fragment=relative(root,target);
  if(isAbsolute(fragment)||fragment==='..'||fragment.startsWith(`..${sep}`)||!['.ts','.js','.mjs'].includes(extname(target)))throw new Error('provider_runtime_path_invalid');
  const resolvedRoot=await realpath(root),resolvedTarget=await realpath(target),resolvedFragment=relative(resolvedRoot,resolvedTarget);
  if(isAbsolute(resolvedFragment)||resolvedFragment==='..'||resolvedFragment.startsWith(`..${sep}`))throw new Error('provider_runtime_path_invalid');
  const module=await import(pathToFileURL(resolvedTarget).href) as {createProviderRuntime?:unknown};
  if(typeof module.createProviderRuntime!=='function')throw new Error('provider_runtime_factory_missing');
  const runtime=await module.createProviderRuntime(context) as ProviderRuntime;
  if(!runtime||!(runtime.adapters instanceof Map)||typeof runtime.admission!=='function'||typeof runtime.admitReal!=='function'
    ||(runtime.prepareCorrection!==undefined&&typeof runtime.prepareCorrection!=='function')||(runtime.advance!==undefined&&typeof runtime.advance!=='function'))throw new Error('provider_runtime_invalid');
  if(runtime.files&&['read','exists','putImmutable'].some(method=>typeof runtime.files![method as keyof AssetStore]!=='function'))throw new Error('provider_runtime_asset_store_invalid');
  for(const [id,adapter]of runtime.adapters){
    if(!adapter||typeof adapter.submit!=='function'||typeof adapter.query!=='function'||typeof adapter.cancel!=='function')throw new Error('provider_runtime_adapter_invalid');
    const caps=AdapterCapabilitiesSchema.parse(await adapter.capabilities());
    if(caps.adapter_id!==id||(caps.mode==='real'&&(!caps.evidence_refs.length||id.startsWith('sim_'))))throw new Error('provider_runtime_capability_invalid');
  }
  return runtime;
}
