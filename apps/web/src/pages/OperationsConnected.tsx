import {Link} from 'react-router';
import {OperationsViewSchema,PipelineCatalogSchema,ProductionsListSchema,ArticleListSchema,InstallationSettingsSchema,productionStateLabels} from '@fbr/contracts';
import {useResource} from '../api.js';
import {Page,ResourceState} from './ConnectedShared.js';
import {CalibrationPanel} from '../components/operations/CalibrationPanel.js';
import {RetentionPanel} from '../components/operations/RetentionPanel.js';
import {InstallationPanel,ConsumptionSchema} from '../components/operations/InstallationPanel.js';
import {minorLabel} from '../components/productions/BudgetRevisionPanel.js';
export function OperationsPage(){
  const operations=useResource('/operations',OperationsViewSchema),catalog=useResource('/pipeline/catalog',PipelineCatalogSchema),data=operations.data;
  return <Page title="Configurações"><h2>Estado da operação</h2><ResourceState {...operations} onRetry={operations.reload}/>
    {data&&<><p>API ativa há {data.http.uptime_seconds} s.</p>{data.runtime&&<><p>Banco disponível. {data.runtime.attention_required?'Há execuções que exigem reconciliação.':'Nenhuma execução incerta detectada.'}</p>
      <p>Montagens interrompidas: {data.runtime.interrupted_assemblies}.</p><div className="connected-cards">{data.runtime.jobs.map(job=><article key={job.state}><h3>{job.state}</h3><p>{job.count} jobs</p></article>)}</div></>}
      <button onClick={operations.reload}>Atualizar estado</button></>}
    <h2>Integrações disponíveis no catálogo</h2><ResourceState {...catalog} onRetry={catalog.reload}/>
    <p>A configuração de acesso pertence ao servidor. A disponibilidade técnica e a validação audiovisual do perfil são conferidas separadamente.</p>
    {catalog.data&&<div className="connected-cards">{catalog.data.models.map(model=><article key={model.id}><h3>{model.provider} · {model.model}</h3>
      <p>Operação: {model.operation}. Acesso: {model.account_access==='verified'?'verificado':'pendente'}. Integração: {model.runtime==='real'?'real disponível':model.runtime==='simulated'?'simulação':'configuração do fornecedor pendente'}.</p>
      {model.documentation_url&&<a href={model.documentation_url} target="_blank" rel="noreferrer">Documentação da operação</a>}</article>)}</div>}
    <InstallationPanel/><CalibrationPanel/><RetentionPanel/>
  </Page>;
}
export function HomeConnected(){
  const resource=useResource('/productions',ProductionsListSchema);
  const consumption=useResource('/consumption',ConsumptionSchema),operations=useResource('/operations',OperationsViewSchema),articles=useResource('/articles?limit=5',ArticleListSchema);
  const settings=useResource('/settings',InstallationSettingsSchema),date=(value:string)=>new Intl.DateTimeFormat('pt-BR',{timeZone:settings.data?.timezone??'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
  return <Page title="Início"><p>Produções, revisões e pendências da instalação.</p><ResourceState {...resource} onRetry={resource.reload}/>
    <p><Link to="/artigos">Selecionar artigo</Link> · <Link to="/producoes">Todas as produções</Link></p>
    <section aria-label="Consumo e trabalhos"><h2>Consumo e trabalhos</h2><ResourceState {...consumption} onRetry={consumption.reload}/>{consumption.data&&<>{consumption.data.window?<p>Período: {date(consumption.data.window.starts_at)} a {date(consumption.data.window.ends_at)} · {settings.data?.timezone??'America/Sao_Paulo'}.</p>:<p>Consumo acumulado; nenhum período de orçamento configurado.</p>}{consumption.data.totals.map(total=><p key={total.currency}>{minorLabel(total.confirmed_minor,total.currency)} confirmados · {minorLabel(total.reserved_minor,total.currency)} reservados{total.unknown?' · Há valores ou instantes ainda desconhecidos.':''}</p>)}</>}
     {operations.data?.runtime?.jobs.map(job=><p key={job.state}>{job.count} trabalhos · {job.state}</p>)}
    </section><section aria-label="Artigos recentes"><h2>Artigos recentes</h2><ResourceState {...articles} onRetry={articles.reload}/>{articles.data?.items.map(({article})=><p key={article.id}><Link to={`/artigos/${article.id}?version=${article.version}`}>{article.title}</Link></p>)}</section>
    {resource.data&&<><p>{resource.data.items.length} produções registradas. {resource.data.items.filter(p=>p.pending_issues.some(issue=>issue.required)).length} com pendências.</p>
      <div className="connected-cards">{resource.data.items.slice(0,12).map(production=><article key={production.id}><h2><Link to={`/producoes/${production.id}`}>{production.name}</Link></h2>
        <p>{productionStateLabels[production.status]} · revisão {production.version}</p>{production.pending_issues.filter(issue=>issue.required).slice(0,2).map(issue=><p key={issue.code}>{issue.message}</p>)}
        {production.status==='ready_for_review'&&<Link to={`/producoes/${production.id}/revisao`}>Revisar vídeo</Link>}</article>)}</div></>}
  </Page>;
}
