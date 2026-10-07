import {z} from 'zod';
import {useResource} from '../../api.js';
import {ResourceState} from '../../pages/ConnectedShared.js';
export const RetentionPlanSchema=z.object({hash:z.string(),now:z.string(),backup_hash:z.string(),backup_verified:z.boolean(),
 policy:z.object({keep_referenced:z.literal(true),orphan_grace_days:z.int().positive()}),files:z.array(z.object({storage_key:z.string(),bytes:z.number()})),
 plan:z.array(z.object({storage_key:z.string(),action:z.enum(['keep','eligible_for_removal']),reason:z.enum(['referenced','grace_period','orphan_after_grace'])}))});
export function RetentionPanel(){
 const resource=useResource('/retention/plan',RetentionPlanSchema),data=resource.data;
 return <section aria-label="Inventário de retenção"><h2>Inventário e retenção</h2><p>Consulta de planejamento. Arquivos referenciados, histórico e backups são preservados. Nenhum arquivo é removido por esta tela.</p>
  <ResourceState {...resource} onRetry={resource.refresh}/><button onClick={resource.refresh}>Atualizar inventário</button>
  {data&&<><p>Inventário: {data.files.length} arquivos · {data.files.reduce((sum,file)=>sum+file.bytes,0).toLocaleString('pt-BR')} bytes. Carência para órfãos: {data.policy.orphan_grace_days} dias.</p>
   <p>{data.backup_verified?'Backup conferido para este planejamento.':'Backup ainda não verificado; execução de descarte permanece bloqueada.'}</p>
   <p>{data.plan.filter(file=>file.action==='eligible_for_removal').length} arquivos órfãos elegíveis no plano, sujeitos à política aprovada e nova conferência de referências.</p>
   <details><summary>Conferir arquivos e motivos</summary><ul>{data.plan.slice(0,200).map(file=><li key={file.storage_key}>{file.storage_key} — {{referenced:'Referenciado: preservar',grace_period:'Dentro da carência: preservar',orphan_after_grace:'Órfão após carência: apenas elegível'}[file.reason]}</li>)}</ul>{data.plan.length>200&&<p>Exibindo os primeiros 200 registros.</p>}</details>
  </>}
 </section>;
}
