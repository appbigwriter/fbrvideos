import {useEffect,useState} from 'react';
import {z} from 'zod';
import {AssetSchema,VersionRefSchema,ProductionSchema,type Asset,type VersionRef} from '@fbr/contracts';
import {useResource,useCommand} from '../../api.js';
import {ResourceState} from '../../pages/ConnectedShared.js';
export const CandidateItemSchema=AssetSchema.safeExtend({preview_url:z.string().regex(/^\/api\//).nullable()});
export const CandidateListSchema=z.strictObject({production:VersionRefSchema,dossier:VersionRefSchema,items:z.array(CandidateItemSchema)});
export function candidateEvaluation(production:VersionRef,asset:Asset,decision:'approved'|'rejected',reviewed:boolean,rights:boolean,reason:string){
 if(!reviewed)throw new Error('Revise o arquivo inteiro antes de decidir.');
 if(decision==='approved'&&!rights)throw new Error('Confirme os direitos de uso antes de aprovar.');
 if(!reason.trim())throw new Error('Registre o motivo da decisão.');
 return {production,asset:{id:asset.id,version:asset.version},hash:asset.file.hash,decision,reviewed_in_full:true as const,rights_confirmed:rights,reason:reason.trim()};
}
export function candidateRetry(production:VersionRef,asset:Asset,reason:string){
 if(asset.status!=='rejected')throw new Error('Nova tentativa exige arquivo rejeitado.');
 if(!reason.trim())throw new Error('Explique o que deve ser corrigido na nova tentativa.');
 return{production,asset:{id:asset.id,version:asset.version},reason:reason.trim()};
}
export function CandidateMediaPanel({productionId,onSaved}:{productionId:string;onSaved:()=>void}){
 const resource=useResource(`/productions/${encodeURIComponent(productionId)}/candidates`,CandidateListSchema);
 useEffect(()=>{const timer=setInterval(resource.refresh,5000);return()=>clearInterval(timer);},[resource.refresh]);
 const saved=()=>{resource.refresh();onSaved();};
 return <section aria-label="Mídia gerada"><h2>Mídia gerada</h2>
  <p>Examine cada arquivo antes de liberar suas dependências. O ensaio sintético não representa aceite audiovisual do piloto.</p>
  <ResourceState {...resource} onRetry={resource.refresh}/>
  {resource.data?.items.length===0&&<p>Nenhum arquivo candidato disponível.</p>}
  <div className="connected-cards">{resource.data?.items.map(asset=><CandidateCard key={`${asset.id}:${asset.version}`} asset={asset} production={resource.data!.production} onSaved={saved}/>)}</div>
 </section>;
}
export function CandidateCard({asset,production,onSaved}:{asset:z.infer<typeof CandidateItemSchema>;production:VersionRef;onSaved:()=>void}){
 const [reviewed,setReviewed]=useState(false),[rights,setRights]=useState(false),[reason,setReason]=useState(''),[validation,setValidation]=useState<string|null>(null);
 const command=useCommand(),[retryReason,setRetryReason]=useState(''),[retrySaved,setRetrySaved]=useState(false);
 const submit=(decision:'approved'|'rejected')=>{try{const body=candidateEvaluation(production,asset,decision,reviewed,rights,reason);setValidation(null);void command.run(`/productions/${encodeURIComponent(production.id)}/candidates/evaluate`,z.unknown(),body,onSaved);}catch(error){setValidation(error instanceof Error?error.message:'Confira a decisão.');}};
 return <article><h3>{{audio:'Áudio',image:'Imagem',clip:'Clipe',render:'Vídeo',subtitle:'Legenda',manifest:'Manifesto'}[asset.type]} · v{asset.version}</h3>
  <p>Estado: {{candidate:'Aguardando revisão',approved:'Aprovado',rejected:'Rejeitado',outdated:'Desatualizado'}[asset.status]}{asset.origin==='fixture'?' · Arquivo sintético':''}.</p>
  {asset.preview_url&&(asset.type==='audio'?<audio controls preload="metadata" src={asset.preview_url}/>:asset.type==='image'?<img style={{maxWidth:'100%',height:'auto'}} src={asset.preview_url} alt="Imagem candidata da produção"/>:['clip','render'].includes(asset.type)?<video style={{maxWidth:'100%'}} controls preload="metadata" src={asset.preview_url}/>:<a href={asset.preview_url}>Examinar arquivo</a>)}
  {!asset.preview_url&&<p>Preview indisponível; confira a pendência antes de avaliar.</p>}
  {asset.file.duration_seconds!==null&&<p>Duração medida: {asset.file.duration_seconds.toFixed(2)} s.</p>}
  {asset.status==='candidate'&&<><label><input type="checkbox" checked={reviewed} onChange={event=>setReviewed(event.target.checked)}/> Examinei o arquivo inteiro e as referências aplicáveis.</label>
   <label><input type="checkbox" checked={rights} onChange={event=>setRights(event.target.checked)}/> Confirmei autorização para uso do arquivo e suas referências.</label>
   <label>Motivo da decisão<textarea value={reason} onChange={event=>setReason(event.target.value)} required/></label>
   <p><button type="button" disabled={command.pending||!asset.preview_url||!reviewed||!rights||!reason.trim()} onClick={()=>submit('approved')}>Aprovar arquivo</button>{' '}
    <button type="button" disabled={command.pending||!asset.preview_url||!reviewed||!reason.trim()} onClick={()=>submit('rejected')}>Rejeitar arquivo</button></p></>}
  {asset.status==='rejected'&&<><p>O arquivo rejeitado não libera dependências. Uma nova tentativa depende do limite de tentativas, da rota e do orçamento disponível.</p>
   <label>O que corrigir na nova tentativa<textarea value={retryReason} onChange={event=>setRetryReason(event.target.value)} required/></label>
   <button type="button" disabled={command.pending||retrySaved||!retryReason.trim()} onClick={()=>{try{const body=candidateRetry(production,asset,retryReason);setValidation(null);void command.run(`/productions/${encodeURIComponent(production.id)}/candidates/retry`,ProductionSchema,body,()=>{setRetrySaved(true);onSaved();});}catch(error){setValidation(error instanceof Error?error.message:'Confira o pedido.');}}}>Solicitar nova tentativa</button>
   {retrySaved&&<p role="status">Nova tentativa solicitada. Acompanhe o trabalho de geração e revise o próximo arquivo.</p>}</>}
  {(validation||command.error)&&<p role="alert">{validation??command.error}</p>}
 </article>;
}
