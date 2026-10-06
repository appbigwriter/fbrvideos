import {useEffect,useRef,useState} from 'react';
import {Link,useParams} from 'react-router';
import {ReviewViewSchema,ReviewPointSchema,ProductionSchema,CorrectionSchema,RenderHistorySchema,SpeechEditViewSchema,
  type ReviewView,type ReviewPoint,type VersionRef,type SceneReviewPanelProps} from '@fbr/contracts';
import {useResource,useCommand} from '../api.js';
import {Page,ResourceState} from './ConnectedShared.js';
import {SceneReviewPanel} from '../components/review/SceneReviewPanel.js';
const categories={image_mismatch:'Imagem não corresponde à fala',identity:'Identidade da personagem',environment:'Ambiente',motion:'Movimento',speech_voice:'Fala ou voz',comment:'Comentário'};
const same=(a:VersionRef|null,b:VersionRef|null)=>!!a&&!!b&&a.id===b.id&&a.version===b.version;
export function ReviewPage(){
  const {id}=useParams(),resource=useResource(id?`/productions/${id}/review`:null,ReviewViewSchema),command=useCommand();
  const video=useRef<HTMLVideoElement>(null),[seconds,setSeconds]=useState(0),[selected,setSelected]=useState<VersionRef|null>(null);
  const [category,setCategory]=useState<SceneReviewPanelProps['category']>('comment'),[comment,setComment]=useState(''),[full,setFull]=useState(false);
  const data=resource.data;
  const awaitingRuntime=!!data&&(['preparing','producing','correcting'].includes(data.status)||data.corrections.some(correction=>correction.status==='proposed'));
  useEffect(()=>{if(!awaitingRuntime)return;const timer=setInterval(resource.refresh,5000);return()=>clearInterval(timer);},[awaitingRuntime,resource.refresh]);
  useEffect(()=>{setFull(false);setSelected(null);setSeconds(0);},[data?.render?.ref.id,data?.render?.ref.version]);
  const select=(ref:VersionRef)=>{const scene=data?.scenes.find(scene=>same(scene.ref,ref));if(!scene)return;setSelected(ref);setSeconds(scene.start_seconds);if(video.current)video.current.currentTime=scene.start_seconds;};
  const submit=()=>{if(!data?.render||!data.actions.comment.enabled||!comment.trim())return;
    void command.run(`/productions/${id}/review/points`,ReviewPointSchema,{production:data.production,render:data.render.ref,render_hash:data.render.hash,
      shot:selected,at_seconds:seconds,category,comment:comment.trim()},()=>{setComment('');resource.reload();});};
  return <Page title="Revisão"><Link to={`/producoes/${id}`}>Voltar ao acompanhamento</Link><ResourceState {...resource} onRetry={resource.reload}/>
    {data&&<><p>{data.name} · revisão {data.production.version}</p><p>{data.notice}</p>
      {data.render&&<video key={`${data.render.ref.id}:${data.render.ref.version}`} ref={video} controls preload="metadata" src={data.render.preview_url}
        style={{width:'100%',maxHeight:520}} aria-label="Prévia do vídeo" onTimeUpdate={event=>{
          const time=Math.max(0,Math.min(event.currentTarget.currentTime,data.render!.duration_seconds));setSeconds(time);
          setSelected(data.scenes.find(scene=>time>=scene.start_seconds&&time<scene.end_seconds)?.ref??null);
        }}/>}<RenderComparison id={id!} revision={data.production.version}/><SceneReviewPanel data={data} loading={false} error={null} pending={command.pending} command_error={command.error}
        selected_shot={selected} current_seconds={seconds} category={category} comment={comment}
        can_submit={data.actions.comment.enabled&&!!comment.trim()&&!command.pending} submit_reason={data.actions.comment.reason}
        onRetry={resource.reload} onSelectShot={select} onCategoryChange={setCategory} onCommentChange={setComment} onSubmit={submit}/>
      <h2>Apontamentos registrados</h2>{data.points.length===0&&<p>Nenhum apontamento registrado.</p>}
      {data.points.map(point=><PointResolution key={`${point.id}:${point.version}`} point={point} data={data} onSaved={resource.reload}/>)}
      {data.corrections.length>0&&<section aria-label="Planos de correção"><h2>Planos de correção</h2>{data.corrections.map(correction=><article key={correction.id}>
        <p>{correction.comment}</p><p>{correction.impact.invalidated.length} derivados afetados; {correction.impact.preserved.length} preservados.</p>
        <p>Estado: {correction.status}. {correction.costs.estimated_minor===null?'Custo ainda não estimado.':`Limite adicional: ${correction.costs.currency} ${(correction.costs.estimated_minor/100).toFixed(2)}.`}</p>
        {['proposed','awaiting_cost_authorization','authorized'].includes(correction.status)&&<button type="button" disabled={command.pending} onClick={()=>{
          void command.run(`/productions/${id}/review/corrections/cancel`,CorrectionSchema,{production:data.production,correction:{id:correction.id,version:correction.version},reason:'Operador optou por cancelar o plano antes de estimativa e execução.'},resource.reload);
        }}>Cancelar plano sem execução</button>}
        {data.correction_plans.filter(plan=>plan.correction_id===correction.id).map(plan=><span key={plan.hash}>
          {correction.status==='awaiting_cost_authorization'&&correction.costs.estimated_minor!==null&&<button type="button" disabled={command.pending} onClick={()=>{
            void command.run(`/productions/${id}/review/corrections/authorize`,CorrectionSchema,{production:data.production,correction:{id:correction.id,version:correction.version},plan_hash:plan.hash,maximum_minor:correction.costs.estimated_minor},resource.reload);
          }}>Autorizar limite deste plano</button>}
          {correction.status==='authorized'&&<button type="button" disabled={command.pending} onClick={()=>{
            void command.run(`/productions/${id}/review/corrections/execute`,CorrectionSchema,{production:data.production,correction:{id:correction.id,version:correction.version},plan_hash:plan.hash},resource.reload);
          }}>Executar plano autorizado</button>}
        </span>)}
      </article>)}</section>}
      <h2>Aprovação final</h2><label><input type="checkbox" checked={full} onChange={e=>setFull(e.target.checked)} disabled={!data.actions.approve.enabled||command.pending}/>
        Assisti integralmente a esta revisão e aprovo sua qualidade editorial e audiovisual.</label>
      <button type="button" className="connected-button" disabled={!full||!data.render||!data.actions.approve.enabled||command.pending} onClick={()=>{
        if(!data.render||!full)return;void command.run(`/productions/${id}/review/approve`,ProductionSchema,
          {production:data.production,render:data.render.ref,render_hash:data.render.hash,reviewed_in_full:true},resource.reload);
      }}>Aprovar revisão assistida</button>{data.actions.approve.reason&&<p>{data.actions.approve.reason}</p>}
      <p><Link to={`/producoes/${id}/entrega`}>Ver entrega</Link></p>
      <SpeechEditor id={id!} revision={data.production.version} onSaved={resource.reload}/>
    </>}</Page>;
}
function SpeechEditor({id,revision,onSaved}:{id:string;revision:number;onSaved:()=>void}){
  const resource=useResource(`/productions/${id}/review/speeches`,SpeechEditViewSchema),command=useCommand();
  const [selected,setSelected]=useState(''),[text,setText]=useState(''),[reason,setReason]=useState(''),[reviewed,setReviewed]=useState(false);
  useEffect(()=>{resource.reload();setReviewed(false);},[revision]);
  const data=resource.data,speech=data?.speeches.find(s=>s.id===selected);
  return <section aria-label="Edição de fala"><h2>Editar fala</h2><ResourceState {...resource} onRetry={resource.reload}/>
    {data&&<><p>{data.notice}</p><label>Fala<select value={selected} disabled={!data.enabled||command.pending} onChange={event=>{
      const value=event.target.value;setSelected(value);setText(data.speeches.find(s=>s.id===value)?.text??'');setReviewed(false);setReason('');
    }}><option value="">Selecione a fala</option>{data.speeches.map(s=><option key={s.id} value={s.id}>{s.text.slice(0,90)}</option>)}</select></label>
      {speech&&<form className="connected-form" onSubmit={event=>{event.preventDefault();if(!data.dossier||!reviewed)return;
        void command.run(`/productions/${id}/review/speeches`,ProductionSchema,{production:data.production,dossier:data.dossier,speech_id:speech.id,
          text:text.trim(),reason:reason.trim(),source_reviewed:true},()=>{setSelected('');setReviewed(false);resource.reload();onSaved();});
      }}><label>Novo texto<textarea value={text} maxLength={12000} disabled={!data.enabled||command.pending} onChange={e=>{setText(e.target.value);setReviewed(false);}}/></label>
        <p>Fontes preservadas: {speech.sources.map(source=>`${source.document.id}:v${source.document.version}/${source.segment_id}`).join(', ')||'Fala sem afirmação factual.'}</p>
        <label>Motivo da alteração<input value={reason} maxLength={4000} disabled={command.pending} onChange={e=>setReason(e.target.value)}/></label>
        <label><input type="checkbox" checked={reviewed} disabled={!data.enabled||command.pending} onChange={e=>setReviewed(e.target.checked)}/>Conferi que o novo texto permanece fiel às fontes indicadas.</label>
        <button type="submit" disabled={!data.enabled||command.pending||!reviewed||!text.trim()||text.trim()===speech.text||!reason.trim()}>Salvar fala e invalidar derivados</button>
      </form>}{command.error&&<p role="alert">{command.error}</p>}</>}
  </section>;
}
function RenderComparison({id,revision}:{id:string;revision:number}){
  const resource=useResource(`/productions/${id}/review/history`,RenderHistorySchema),[selected,setSelected]=useState('');
  useEffect(()=>{resource.refresh();},[revision,resource.refresh]);
  const versions=resource.data?.items.filter(item=>!item.current)??[];
  const previous=versions.find(item=>String(item.production.version)===selected);
  return <section aria-label="Comparação de versões"><h2>Comparar com versão anterior</h2><ResourceState {...resource} onRetry={resource.reload}/>
    {resource.data&&versions.length===0&&<p>Nenhum render anterior registrado.</p>}
    {versions.length>0&&<label>Versão anterior<select value={selected} onChange={e=>setSelected(e.target.value)}>
      <option value="">Selecione uma revisão</option>{versions.map(item=><option key={item.production.version} value={item.production.version} disabled={!item.available}>
        Produção v{item.production.version} · render v{item.render.version}{item.available?'':' · arquivo indisponível'}</option>)}</select></label>}
    {previous&&<><p>Vídeo histórico da produção v{previous.production.version}. A aprovação desta página se aplica ao vídeo atual.</p>
      <video key={previous.preview_url} controls preload="metadata" src={previous.preview_url} aria-label="Vídeo da versão anterior" style={{width:'100%',maxHeight:360}}/>
      {previous.scenes.map(scene=><p key={`${scene.ref.id}:${scene.ref.version}`}>{scene.start_seconds.toFixed(2)}–{scene.end_seconds.toFixed(2)} s · {scene.transcript}</p>)}</>}
  </section>;
}
function PointResolution({point,data,onSaved}:{point:ReviewPoint;data:ReviewView;onSaved:()=>void}){
  const command=useCommand(),[reason,setReason]=useState('');
  const enabled=point.status==='open'&&data.status==='ready_for_review';
  const resolve=(status:'dismissed'|'addressed')=>{if(!reason.trim())return;void command.run(`/productions/${data.production.id}/review/resolve`,ReviewPointSchema,
    {production:data.production,point:{id:point.id,version:point.version},status,reason:reason.trim()},onSaved);};
  return <article><p>{point.at_seconds.toFixed(2)} s · {categories[point.category]} · {{open:'Aberto',dismissed:'Dispensado com justificativa',addressed:'Corrigido em outra revisão'}[point.status]}</p>
    <p>{point.comment}</p>{point.resolution&&<p>{point.resolution}</p>}{enabled&&<>
      <label>Justificativa<input value={reason} maxLength={4000} disabled={command.pending} onChange={e=>setReason(e.target.value)}/></label>
      <button type="button" disabled={command.pending||!reason.trim()} onClick={()=>resolve('dismissed')}>Dispensar com justificativa</button>
      <button type="button" disabled={command.pending||!reason.trim()||same(data.render?.ref??null,point.render)||!data.render} onClick={()=>resolve('addressed')}>Registrar correção na nova revisão</button>
      <button type="button" disabled={command.pending||!data.render||!same(data.render.ref,point.render)} onClick={()=>{
        void command.run(`/productions/${data.production.id}/review/corrections`,CorrectionSchema,{production:data.production,point:{id:point.id,version:point.version}},onSaved);
      }}>Preparar plano de correção</button>
    </>}{command.error&&<p role="alert">{command.error}</p>}</article>;
}

