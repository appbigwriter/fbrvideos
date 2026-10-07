import {AssetSchema,GenerationExecutionSchema,type Asset,type GenerationExecution} from '@fbr/contracts';
import {canonical,sameRef} from '@fbr/domain';
import type {SqlClient} from './configuration-store.js';

/** Avaliação e faturamento podem criar revisões sem mudar o output original. */
export async function belongsToExecution(client:SqlClient,productionId:string,asset:Asset,execution:GenerationExecution){
  const latest=execution.provider_job;
  if(!latest||!asset.execution||latest.id!==asset.execution.id||latest.version<asset.execution.version
    ||execution.intent.request.production.id!==productionId||asset.configuration_hash!==execution.intent.request.configuration_hash)return false;
  const rows=(await client.query('SELECT record FROM generation_revisions WHERE id=$1 ORDER BY version',[execution.id])).rows;
  const original=rows.map(row=>GenerationExecutionSchema.parse(row.record)).find(value=>value.provider_job&&sameRef(value.provider_job,asset.execution!));
  if(!original?.provider_job||original.intent.request.execution_key!==execution.intent.request.execution_key
    ||original.provider_job.configuration_hash!==asset.configuration_hash)return false;
  for(const ref of original.provider_job.output_assets){
    if(ref.id!==asset.id||ref.version>asset.version)continue;
    const row=(await client.query("SELECT r.record FROM media_revisions r JOIN media_heads h USING(kind,id) WHERE r.kind='asset' AND r.id=$1 AND r.version=$2 AND h.production_id=$3",[ref.id,ref.version,productionId])).rows[0];
    if(!row)continue;
    const output=AssetSchema.parse(row.record);
    if(canonical(output.file)===canonical(asset.file)&&canonical(output.execution)===canonical(asset.execution)
      &&sameRef(output.specification,asset.specification)&&canonical(output.references)===canonical(asset.references)
      &&output.type===asset.type&&output.configuration_hash===asset.configuration_hash)return true;
  }
  return false;
}
