import {useRef,useState} from 'react';
import {z} from 'zod';
import {ProductionsListSchema,VersionRefSchema,type Production} from '@fbr/contracts';
import {api,useResource} from '../../api.js';
import {ResourceState} from '../../pages/ConnectedShared.js';
const Targets=z.strictObject({minimum_samples:z.int().positive(),approval_rate:z.number().min(0).max(1)});
export const CalibrationReportSchema=z.object({profile:VersionRefSchema,targets:Targets,hash:z.string().regex(/^[a-f0-9]{64}$/),evidence:z.array(z.unknown()),
 sample_counts:z.object({real:z.int().nonnegative(),synthetic:z.int().nonnegative(),unknown:z.int().nonnegative()}).optional(),
 report:z.object({samples:z.int().nonnegative(),reviewed:z.int().nonnegative(),approved:z.int().nonnegative(),approval_rate:z.number().nullable(),corrections:z.int().nonnegative(),fallbacks:z.int().nonnegative(),currency:z.string().nullable(),confirmed_minor:z.number().nullable(),human_minutes:z.number().nullable(),targets_met:z.boolean(),automatic_profile_validation:z.literal(false)})});
type ObservationFields={id:string;version:string;article_class:string;format:string;corrections:string;fallbacks:string;cost:string;minutes:string;reviewed:boolean;approved:boolean;reviewer:string;evidence:string};
export function calibrationObservation(production:Production,fields:ObservationFields,at:string){
 const integer=(value:string,label:string)=>{if(!/^\d+$/.test(value.trim()))throw new Error(`Informe ${label} como inteiro não negativo.`);return Number(value);};
 if(fields.approved&&!fields.reviewed)throw new Error('Aceite exige revisão humana declarada.');
 if(!fields.id.trim()||!fields.article_class.trim()||!fields.format.trim()||!fields.reviewer.trim()||!fields.evidence.trim())throw new Error('Preencha identificação, classe, formato, responsável e evidências.');
 const version=integer(fields.version,'a revisão');if(version<1)throw new Error('Revisão deve ser positiva.');
 const minutes=fields.minutes.trim()===''?null:Number(fields.minutes);if(minutes!==null&&(!Number.isFinite(minutes)||minutes<0))throw new Error('Tempo deve ser não negativo ou desconhecido.');
 return {id:fields.id.trim(),version,recorded_by:fields.reviewer.trim(),recorded_at:at,evidence:fields.evidence.split('\n').map(value=>value.trim()).filter(Boolean),observation:{
  production:{id:production.id,version:production.version},profile:production.profile,article_class:fields.article_class.trim(),format:fields.format.trim(),
  human_reviewed:fields.reviewed,approved:fields.approved,corrections:integer(fields.corrections,'o retrabalho'),fallbacks:integer(fields.fallbacks,'as alternativas'),
  currency:production.costs.currency,confirmed_minor:fields.cost.trim()===''?null:integer(fields.cost,'o custo em centavos'),human_minutes:minutes}};
}
function useEvidenceCommand(){const [pending,setPending]=useState(false),[error,setError]=useState<string|null>(null),[saved,setSaved]=useState(false),busy=useRef(false);
 async function run(path:string,body:object,onSaved?:()=>void){if(busy.current)return;busy.current=true;setPending(true);setError(null);setSaved(false);
  try{await api(path,z.unknown(),body);setSaved(true);onSaved?.();}catch(error){setError(error instanceof Error?error.message:'Não foi possível registrar.');}finally{busy.current=false;setPending(false);}}
 return {pending,error,saved,run};}
export function CalibrationPanel(){
 const productions=useResource('/productions',ProductionsListSchema),[selected,setSelected]=useState(''),[scope,setScope]=useState<string|null>(null),[samples,setSamples]=useState('3'),[rate,setRate]=useState('0.8');
 const report=useResource(scope,CalibrationReportSchema),[validation,setValidation]=useState<string|null>(null);
 const production=productions.data?.items.find(item=>item.id===selected);
 const load=()=>{if(!production)return;const targets=Targets.safeParse({minimum_samples:Number(samples),approval_rate:Number(rate)});if(!targets.success){setValidation('Confira a quantidade mínima e a proporção de aprovação.');return;}setValidation(null);
  const query=new URLSearchParams({profile_id:production.profile.id,profile_version:String(production.profile.version),minimum_samples:samples,approval_rate:rate});const path=`/calibration/reports?${query}`;if(scope===path)report.refresh();else setScope(path);};
 return <section aria-label="Calibração"><h2>Calibração e evidências</h2><p>Observações não validam o perfil automaticamente. Custos e tempo ausentes permanecem desconhecidos.</p>
  <ResourceState {...productions} onRetry={productions.refresh}/>
  <label>Produção observada<select value={selected} onChange={event=>{setSelected(event.target.value);setScope(null);}}><option value="">Selecione uma produção</option>{productions.data?.items.map(p=><option key={p.id} value={p.id}>{p.name} · v{p.version}</option>)}</select></label>
  {production&&<><p>Perfil: {production.profile.id} · v{production.profile.version}. A observação fixa a produção v{production.version}.</p>
   <ObservationForm key={`${production.id}:${production.version}`} production={production} onSaved={report.refresh}/>
   <form className="connected-form" onSubmit={event=>{event.preventDefault();load();}}><h3>Relatório por perfil</h3>
    <label>Mínimo de amostras revisadas<input type="number" min="1" step="1" value={samples} onChange={event=>setSamples(event.target.value)} required/></label>
    <label>Proporção mínima de aprovação (0 a 1)<input type="number" min="0" max="1" step="0.01" value={rate} onChange={event=>setRate(event.target.value)} required/></label><button>Consultar relatório</button></form></>}
  {validation&&<p role="alert">{validation}</p>}<ResourceState {...report} onRetry={report.refresh}/>
  {report.data&&<><dl><dt>Amostras</dt><dd>{report.data.report.samples}</dd><dt>Revisadas / aprovadas</dt><dd>{report.data.report.reviewed} / {report.data.report.approved}</dd><dt>Taxa de aprovação</dt><dd>{report.data.report.approval_rate===null?'Desconhecida':`${(100*report.data.report.approval_rate).toFixed(1)}%`}</dd>
   <dt>Retrabalho / alternativas</dt><dd>{report.data.report.corrections} / {report.data.report.fallbacks}</dd><dt>Custo confirmado</dt><dd>{report.data.report.confirmed_minor===null?'Desconhecido':`${report.data.report.currency} ${(report.data.report.confirmed_minor/100).toFixed(2)}`}</dd><dt>Tempo humano</dt><dd>{report.data.report.human_minutes===null?'Desconhecido':`${report.data.report.human_minutes} min`}</dd></dl>
   {report.data.sample_counts&&<p>Origem das amostras: {report.data.sample_counts.real} reais, {report.data.sample_counts.synthetic} sintéticas, {report.data.sample_counts.unknown} sem comprovação. Cada produção conta uma vez. As metas para validação consideram apenas amostras reais comprovadas.</p>}
   <p>{report.data.report.targets_met?'Metas calculadas atingidas; decisão humana ainda necessária.':'Metas ainda não demonstradas pelas evidências reais.'}</p>
   <DecisionForm key={report.data.hash} report={report.data}/></>}
 </section>;
}
function ObservationForm({production,onSaved}:{production:Production;onSaved:()=>void}){
 const recordedAt=useRef<string|null>(null);
 const [fields,setFields]=useState<ObservationFields>({id:crypto.randomUUID(),version:'1',article_class:'',format:'',corrections:'',fallbacks:'',cost:'',minutes:'',reviewed:false,approved:false,reviewer:'',evidence:''}),[error,setError]=useState<string|null>(null),command=useEvidenceCommand();
 const change=(key:keyof ObservationFields,value:string|boolean)=>setFields(current=>({...current,[key]:value}));
 return <details><summary>Registrar observação</summary><form className="connected-form" onSubmit={event=>{event.preventDefault();try{recordedAt.current??=new Date().toISOString();const body=calibrationObservation(production,fields,recordedAt.current);setError(null);void command.run('/calibration/observations',body,onSaved);}catch(error){setError(error instanceof Error?error.message:'Confira os campos.');}}}>
  <p>Registre apenas valores medidos e evidências existentes. Deixe custo/tempo em branco quando desconhecidos.</p>
  <label>Identificação da observação<input value={fields.id} onChange={event=>change('id',event.target.value)} required/></label><label>Revisão da observação<input type="number" min="1" value={fields.version} onChange={event=>change('version',event.target.value)} required/></label>
  <label>Classe do artigo<input value={fields.article_class} onChange={event=>change('article_class',event.target.value)} required/></label><label>Formato observado<input value={fields.format} onChange={event=>change('format',event.target.value)} required/></label>
  <label>Correções observadas<input type="number" min="0" value={fields.corrections} onChange={event=>change('corrections',event.target.value)} required/></label><label>Alternativas observadas<input type="number" min="0" value={fields.fallbacks} onChange={event=>change('fallbacks',event.target.value)} required/></label>
  <label>Custo confirmado em centavos ({production.costs.currency}) — vazio se desconhecido<input type="number" min="0" value={fields.cost} onChange={event=>change('cost',event.target.value)}/></label><label>Tempo humano em minutos — vazio se desconhecido<input type="number" min="0" step="0.1" value={fields.minutes} onChange={event=>change('minutes',event.target.value)}/></label>
  <label><input type="checkbox" checked={fields.reviewed} onChange={event=>change('reviewed',event.target.checked)}/> Houve revisão humana integral registrada.</label><label><input type="checkbox" checked={fields.approved} onChange={event=>change('approved',event.target.checked)}/> A revisão observada foi aprovada.</label>
  <label>Responsável pelo registro<input value={fields.reviewer} onChange={event=>change('reviewer',event.target.value)} required/></label><label>Evidências — uma por linha<textarea value={fields.evidence} onChange={event=>change('evidence',event.target.value)} required/></label>
  <button disabled={command.pending}>Registrar observação</button>{(error||command.error)&&<p role="alert">{error??command.error}</p>}{command.saved&&<p role="status">Observação registrada.</p>}
 </form></details>;
}
function DecisionForm({report}:{report:z.infer<typeof CalibrationReportSchema>}){
 const recordedAt=useRef<string|null>(null);
 const [id]=useState(()=>crypto.randomUUID()),[reviewed,setReviewed]=useState(false),[outcome,setOutcome]=useState(''),[reviewer,setReviewer]=useState(''),[reason,setReason]=useState(''),command=useEvidenceCommand();
 return <form className="connected-form" onSubmit={event=>{event.preventDefault();if(!reviewed||!['validated','rejected'].includes(outcome))return;recordedAt.current??=new Date().toISOString();void command.run('/calibration/decisions',{id,profile:report.profile,targets:report.targets,report_hash:report.hash,human_reviewed:true,outcome,reviewer:reviewer.trim(),reason:reason.trim(),recorded_at:recordedAt.current});}}>
  <h3>Decisão sobre o relatório</h3><label><input type="checkbox" checked={reviewed} onChange={event=>setReviewed(event.target.checked)}/> Revisei as evidências e o relatório completo.</label>
  <label>Decisão<select value={outcome} onChange={event=>setOutcome(event.target.value)} required><option value="">Selecione</option><option value="validated" disabled={!report.report.targets_met}>Validado pelas evidências</option><option value="rejected">Não validado</option></select></label>
  <label>Responsável<input value={reviewer} onChange={event=>setReviewer(event.target.value)} required/></label><label>Motivo<textarea value={reason} onChange={event=>setReason(event.target.value)} required/></label><button disabled={command.pending||!reviewed||!outcome||!reviewer.trim()||!reason.trim()}>Registrar decisão humana</button>
  {command.error&&<p role="alert">{command.error}</p>}{command.saved&&<p role="status">Decisão registrada; o perfil não foi alterado automaticamente.</p>}
 </form>;
}
