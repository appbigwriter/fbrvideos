import { useState,useEffect } from 'react';
import {z} from 'zod';
import { Link,useNavigate,useParams,useSearchParams } from 'react-router';
import { ProfilesSchema,ArticleSchema,ProductionSchema,ProductionDetailSchema,ProductionsListSchema,productionStateLabels,
  GenerationListSchema, type Profile, type Article,type ProductionDetail } from '@fbr/contracts';
import { useResource,useCommand,api } from '../api.js';
import { ProductionSetupPanel } from '../components/productions/ProductionSetupPanel.js';
import { DossierPanel } from '../components/dossier/DossierPanel.js';
import { ProductionProgressPanel } from '../components/progress/ProductionProgressPanel.js';
import { FormActions } from '../components/forms/FormActions.js';
import { Page,ResourceState,refValue } from './ConnectedShared.js';
import { productionSetup,dossierPresentation,progressPresentation } from './ProductionPresentation.js';
import {CandidateMediaPanel} from '../components/productions/CandidateMediaPanel.js';
import {BudgetRevisionPanel} from '../components/productions/BudgetRevisionPanel.js';
export function ProductionsPage() {
  const resource=useResource('/productions',ProductionsListSchema);
  return <Page title="Produções"><Link to="/artigos">Selecionar artigo</Link><ResourceState {...resource} onRetry={resource.reload}/>
    {resource.data?.items.length===0&&<p>Nenhuma produção cadastrada.</p>}<div className="connected-cards">{resource.data?.items.map(p=><article key={p.id}><h2><Link to={`/producoes/${p.id}`}>{p.name}</Link></h2><p>{productionStateLabels[p.status]} · v{p.version}</p>{p.pending_issues.map(i=><p key={i.code}>{i.message}</p>)}</article>)}</div></Page>;
}
export function CreateProductionPage() {
  const [query]=useSearchParams();const id=query.get('artigo');const version=query.get('version');
  const article=useResource(id?`/articles/${encodeURIComponent(id)}${version?`?version=${encodeURIComponent(version)}`:''}`:null,ArticleSchema);
  const profiles=useResource('/profiles',ProfilesSchema);
  return <Page title="Criar produção">{!id&&<p>Selecione um artigo na <Link to="/artigos">lista de artigos</Link>.</p>}
    <ResourceState {...article} onRetry={article.reload}/><ResourceState {...profiles} onRetry={profiles.reload}/>
    {article.data&&profiles.data&&<CreationForm key={refValue(article.data)} article={article.data} profiles={profiles.data.items}/>}</Page>;
}
export function CreationForm({article,profiles}:{article:Article;profiles:Profile[]}) {
  const command=useCommand(),navigate=useNavigate();const [name,setName]=useState(''),[profile,setProfile]=useState('');
  const [mode,setMode]=useState<'calibration'|'recurring'>('calibration');
  const [targetSeconds,setTargetSeconds]=useState(''),[avoid,setAvoid]=useState('');
  const candidate=profiles.find(p=>refValue(p)===profile);
  const setup=productionSetup(article,candidate,name,mode,targetSeconds,avoid);
  return <form className="connected-form production-setup-integration" onSubmit={event=>{event.preventDefault();
    if(setup.request) void command.run('/productions',ProductionSchema,setup.request,p=>navigate(`/producoes/${p.id}`));}}>
    <p>A produção fixa as revisões selecionadas e inicia planejamento automático. Quando configurado por OAuth, utiliza a cota da conta. Ainda não gera mídia.</p>
    <ProductionSetupPanel summary={{data:setup.summary,loading:false,error:null,onRetry:()=>{}}} options={{
      name,profile_value:profile,profile_options:profiles.filter(p=>p.character.id===article.character?.id&&p.character.version===article.character.version).map(p=>({value:refValue(p),label:`${p.name} · v${p.version}`})),
      mode,target_seconds:targetSeconds,avoid,pending:command.pending,error:command.error,
      onNameChange:setName,onProfileChange:setProfile,onModeChange:setMode,onTargetSecondsChange:setTargetSeconds,onAvoidChange:setAvoid}}/>
    <p>Itens a evitar: uma orientação por linha. Duração em branco utiliza a configuração do perfil.</p>
    <FormActions pending={command.pending} can_submit={setup.summary.can_submit} submit_label="Criar produção e planejar" blocked_reason={setup.summary.blockers[0]?.message??null} onCancel={()=>navigate('/artigos')}/>
  </form>;
}
export function ProductionPage() {
  const {id}=useParams();const resource=useResource(id?`/productions/${id}`:null,ProductionDetailSchema),command=useCommand();
  const jobs=useResource(id?`/productions/${id}/jobs`:null,GenerationListSchema);
  const refresh=()=>{resource.reload();jobs.reload();};
  const detail=resource.data;
  const active=!!detail&&['preparing','producing','correcting'].includes(detail.production.status);
  useEffect(()=>{if(!active)return;const timer=setInterval(()=>{resource.refresh();jobs.refresh();},5000);return()=>clearInterval(timer);},[active,resource.refresh,jobs.refresh]);
  const dossier=detail ? dossierPresentation(detail) : {data:null,error:null};
  const progress=detail ? progressPresentation(detail) : null;
  const sendCommand=(action:'pause'|'resume'|'cancel')=>{
    if(!detail || !detail.actions[action]) return;
    void command.run(`/productions/${id}/commands`,ProductionSchema,
      {production:{id:detail.production.id,version:detail.production.version},action},refresh);
  };
  return <Page title="Acompanhamento da produção"><section className="production-progress-integration" aria-label="Acompanhamento e consumo">
    <h2>Estado e consumo</h2><ProductionProgressPanel data={progress} loading={resource.loading} error={resource.error}
      pending={command.pending} command_error={command.error} onRetry={refresh} onRefresh={refresh}
      onPause={()=>sendCommand('pause')} onResume={()=>sendCommand('resume')} onCancel={()=>sendCommand('cancel')}/>
    </section><section aria-label="Trabalhos de geração"><h2>Trabalhos de geração</h2>
      <ResourceState {...jobs} onRetry={jobs.reload}/>
      {jobs.data?.items.length===0&&<p>Nenhum trabalho de geração iniciado.</p>}
      <div className="connected-cards">{jobs.data?.items.map(job=><article key={job.ref.id}>
        <h3>{{audio:'Áudio',image:'Imagem',animation:'Animação',avatar:'Avatar',render:'Montagem'}[job.operation]}</h3>
        <p>{{prepared:'Na fila',submitting:'Enviando',active:'Em andamento',unknown:'Requer reconciliação',succeeded:'Concluído',failed:'Falhou',cancelled:'Cancelado'}[job.state]} · tentativa {job.attempt}{job.simulated?' · Simulação':''}</p>
        <p>Estimado: {money(job.costs.estimated_minor,job.costs.currency)} · Reservado: {money(job.costs.committed_minor,job.costs.currency)} · Confirmado: {money(job.costs.confirmed_minor,job.costs.currency)}</p>
        {job.message&&<p role="status">{job.message}</p>}
        {detail&&['failed','cancelled'].includes(job.state)&&<ExecutionRetry production={detail.production} execution={job.ref} onSaved={refresh}/>}
        {detail&&job.state==='prepared'&&<PendingExecutionActions production={detail.production} execution={job.ref} onSaved={refresh}/>}
      </article>)}</div>
    </section>{detail&&<>
    <p>Fonte: {detail.snapshot.article.title} · v{detail.snapshot.article.version}; perfil: {detail.snapshot.profile.name} · v{detail.snapshot.profile.version}.</p>
    <h2>Histórico</h2><ol>{detail.events.map(event=><li key={event.id}>v{event.production.version} · {event.message}</li>)}</ol>
    <p><Link to={`/producoes/${id}/revisao`}>Abrir revisão</Link> · <Link to={`/producoes/${id}/entrega`}>Ver entrega</Link></p>
  </>}<section className="dossier-integration" aria-label="Dossiê de planejamento"><h2>Dossiê de planejamento</h2><DossierPanel data={dossier.data} loading={resource.loading} error={resource.error??dossier.error} onRetry={resource.reload}/></section>
    {detail&&<PlanningConsent key={`${detail.production.id}:${detail.production.version}`} detail={detail} onSaved={refresh}/>}
    {detail&&<GenerationStart detail={detail} onSaved={refresh}/>}
    {detail&&<BudgetRevisionPanel production={detail.production} onSaved={refresh}/>}
    {id&&detail&&['assembly','review','delivery'].includes(detail.production.stage)&&<AssemblyReport productionId={id}/>}
    {id&&active&&<CandidateMediaPanel productionId={id} onSaved={()=>{resource.refresh();jobs.refresh();}}/>}</Page>;
}
const GenerationStatusSchema=z.object({configured:z.boolean(),reason:z.string().nullable()});
function GenerationStart({detail,onSaved}:{detail:ProductionDetail;onSaved:()=>void}){
  const command=useCommand(),p=detail.production,d=detail.dossier;
  const eligible=!!d&&p.status==='awaiting_decision'&&d.approvals.some(a=>a.kind==='editorial'&&a.status==='active');
  const setup=useResource(eligible?`/productions/${p.id}/generation/status`:null,GenerationStatusSchema);
  if(!eligible||!d)return null;
  return <section aria-label="Iniciar geração"><h2>Gerar mídia</h2><p>O servidor confere conexões, estimativas e limite antes de cada envio. Ensaios sintéticos permanecem identificados.</p>
    <ResourceState {...setup} onRetry={setup.reload}/>{setup.data?.reason&&<p role="status">{setup.data.reason}</p>}
    <button type="button" disabled={command.pending||!setup.data?.configured} onClick={()=>void command.run(`/productions/${p.id}/generation/start`,ProductionSchema,{production:{id:p.id,version:p.version},dossier:{id:d.id,version:d.version}},onSaved)}>Iniciar geração configurada</button>
    {command.error&&<p role="alert">{command.error}</p>}</section>;
}
const AssemblyReportSchema=z.object({runs:z.array(z.object({state:z.string(),diagnostic:z.string().nullable(),production_version:z.number(),mix:z.object({status:z.string(),integrated_lufs:z.number().nullable(),true_peak_dbtp:z.number().nullable()}).nullable()}))});
function AssemblyReport({productionId}:{productionId:string}){
  const report=useResource(`/productions/${productionId}/assembly`,AssemblyReportSchema);return <section aria-label="Verificação da montagem"><h2>Montagem e qualidade técnica</h2><ResourceState {...report} onRetry={report.reload}/>
    {report.data?.runs.slice(0,3).map((run,index)=><article key={index}><p>Produção v{run.production_version} · {run.state}</p>{run.mix&&<p>Mixagem: {run.mix.status} · LUFS: {run.mix.integrated_lufs??'desconhecido'} · Pico real: {run.mix.true_peak_dbtp??'desconhecido'} dBTP</p>}{run.diagnostic&&<p role="status">{run.diagnostic.startsWith('assembly_quality_')?'Verificação de qualidade pendente. Conferir evidências, política e inputs antes de repetir a montagem.':'Montagem interrompida ou falhou; conferir o diagnóstico operacional.'}</p>}</article>)}<p>Verificação técnica não substitui revisão editorial, legibilidade e sincronismo labial do vídeo integral.</p></section>;
}
function ExecutionRetry({production,execution,onSaved}:{production:ProductionDetail['production'];execution:{id:string;version:number};onSaved:()=>void}){
  const command=useCommand(),[reason,setReason]=useState('');return <div><label>Motivo da nova tentativa<input value={reason} onChange={event=>setReason(event.target.value)}/></label>
    <button type="button" disabled={command.pending||!reason.trim()} onClick={()=>void command.run(`/productions/${production.id}/jobs/retry`,ProductionSchema,{production:{id:production.id,version:production.version},execution,reason},onSaved)}>Solicitar alternativa dentro dos limites</button>{command.error&&<p role="alert">{command.error}</p>}</div>;
}
function PendingExecutionActions({production,execution,onSaved}:{production:ProductionDetail['production'];execution:{id:string;version:number};onSaved:()=>void}){
  const command=useCommand(),[reason,setReason]=useState(''),[refreshing,setRefreshing]=useState(false),[notice,setNotice]=useState('');
  return <div><p>Operação ainda não enviada. Atualizar a cotação conserva a reserva somente se preço e parâmetros continuarem iguais.</p>
    <button type="button" disabled={command.pending||refreshing} onClick={()=>{setRefreshing(true);setNotice('');void api(`/productions/${production.id}/jobs/refresh-quote`,z.object({refreshed:z.literal(true)}),{production:{id:production.id,version:production.version},execution}).then(()=>{setNotice('Cotação conferida; a execução segue condicionada ao orçamento e aos inputs aprovados.');onSaved();}).catch(error=>setNotice(error instanceof Error?error.message:'Cotação indisponível.')).finally(()=>setRefreshing(false));}}>Conferir cotação pendente</button>
    <label>Motivo do cancelamento<input value={reason} onChange={event=>setReason(event.target.value)}/></label><button type="button" disabled={command.pending||refreshing||!reason.trim()} onClick={()=>void command.run(`/productions/${production.id}/jobs/cancel-pending`,ProductionSchema,{production:{id:production.id,version:production.version},execution,reason},onSaved)}>Cancelar somente esta operação não enviada</button>{notice&&<p role="status">{notice}</p>}{command.error&&<p role="alert">{command.error}</p>}</div>;
}
function PlanningConsent({detail,onSaved}:{detail:ProductionDetail;onSaved:()=>void}){
  const [sources,setSources]=useState(false),[direction,setDirection]=useState(false),command=useCommand(),d=detail.dossier,p=detail.production;
  if(!d||p.status!=='awaiting_decision'||d.assets.length||d.approvals.some(approval=>approval.kind==='editorial'&&approval.status==='active'))return null;
  return <section aria-label="Aprovação do planejamento"><h2>Conferir roteiro e direção</h2>
    <label><input type="checkbox" checked={sources} disabled={command.pending} onChange={event=>setSources(event.target.checked)}/>Conferi a fidelidade de todas as falas às fontes indicadas.</label>
    <label><input type="checkbox" checked={direction} disabled={command.pending} onChange={event=>setDirection(event.target.checked)}/>Revisei a intenção, direção e referências de todas as cenas.</label>
    <p>A revisão do planejamento não confirma qualidade de mídia ainda não gerada nem autoriza custo desconhecido.</p>
    <button type="button" disabled={command.pending||!sources||!direction||d.pending_issues.some(issue=>issue.required&&issue.code!=='editorial_review_required')} onClick={()=>{
      void command.run(`/productions/${p.id}/planning/approve`,ProductionSchema,{production:{id:p.id,version:p.version},dossier:{id:d.id,version:d.version},reviewed_sources:true,reviewed_direction:true},onSaved);
    }}>Registrar revisão do planejamento</button>{command.error&&<p role="alert">{command.error}</p>}
  </section>;
}
function money(minor:number,currency:string) {
  const formatter=new Intl.NumberFormat('pt-BR',{style:'currency',currency});
  return formatter.format(minor/(10**(formatter.resolvedOptions().maximumFractionDigits??2)));
}
