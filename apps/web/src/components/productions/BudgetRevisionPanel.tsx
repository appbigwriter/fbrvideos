import {useState} from 'react';
import {ProductionSchema,type Production} from '@fbr/contracts';
import {useCommand} from '../../api.js';
export function currencyDecimals(currency:string){return new Intl.NumberFormat('pt-BR',{style:'currency',currency}).resolvedOptions().maximumFractionDigits??2;}
export function decimalToMinor(value:string,currency:string){
 const decimals=currencyDecimals(currency),text=value.trim();
 if(!new RegExp(`^(?:0|[1-9]\\d*)(?:[.,]\\d{1,${Math.max(1,decimals)}})?$`).test(text))throw new Error('Informe o valor sem separador de milhar e com as casas decimais da moeda.');
 const [whole,fraction='']=text.replace(',','.').split('.');
 if(fraction.length>decimals)throw new Error('A moeda não aceita essa quantidade de casas decimais.');
 const minor=BigInt(whole!)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0');
 if(minor>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Valor excede o limite suportado.');return Number(minor);
}
export function minorLabel(value:number,currency:string){const decimals=currencyDecimals(currency),raw=String(value).padStart(decimals+1,'0');return decimals?`${currency} ${raw.slice(0,-decimals)},${raw.slice(-decimals)}`:`${currency} ${raw}`;}
export function budgetRevision(production:Production,fields:{ceiling:string;reason:string;source:string;evidence:string;reviewed:boolean}){
 if(!fields.reviewed)throw new Error('Confira o limite, a moeda e a evidência antes de registrar.');
 if(!fields.reason.trim()||!fields.source.trim()||!fields.evidence.trim())throw new Error('Informe motivo, origem da autorização e evidência.');
 const ceiling=decimalToMinor(fields.ceiling,production.costs.currency);
 if(ceiling<production.costs.confirmed_minor+production.costs.committed_minor+production.costs.safety_margin_minor)throw new Error('O limite precisa cobrir custo confirmado, reserva e margem de segurança.');
 return{production:{id:production.id,version:production.version},currency:production.costs.currency,ceiling_minor:ceiling,reason:fields.reason.trim(),source:fields.source.trim(),evidence:fields.evidence.trim(),reviewed:true as const};
}
export function BudgetRevisionPanel({production,onSaved}:{production:Production;onSaved:()=>void}){
 const [ceiling,setCeiling]=useState(''),[reason,setReason]=useState(''),[source,setSource]=useState(''),[evidence,setEvidence]=useState(''),[reviewed,setReviewed]=useState(false),[error,setError]=useState<string|null>(null),[saved,setSaved]=useState(false),command=useCommand();
 return <section aria-label="Limite de orçamento"><h2>Orçamento da produção</h2>
  <p>Limite atual: {minorLabel(production.costs.ceiling_minor,production.costs.currency)}. Margem de segurança: {minorLabel(production.costs.safety_margin_minor,production.costs.currency)}.</p>
  <p>Confirmado: {minorLabel(production.costs.confirmed_minor,production.costs.currency)} · Reservado: {minorLabel(production.costs.committed_minor,production.costs.currency)}.</p>
  <details><summary>Registrar alteração explícita do limite</summary><form className="connected-form" onSubmit={event=>{event.preventDefault();try{const body=budgetRevision(production,{ceiling,reason,source,evidence,reviewed});setError(null);void command.run(`/productions/${encodeURIComponent(production.id)}/budget`,ProductionSchema,body,()=>{setSaved(true);setReviewed(false);onSaved();});}catch(error){setError(error instanceof Error?error.message:'Confira os campos do orçamento.');}}}>
   <p>Alterar o teto exige autorização registrada. A moeda permanece {production.costs.currency}; este formulário não converte valores nem comprova acesso ao fornecedor.</p>
   <label>Novo limite em {production.costs.currency}<input inputMode="decimal" value={ceiling} onChange={event=>{setCeiling(event.target.value);setReviewed(false);}} required placeholder={currencyDecimals(production.costs.currency)?'Ex.: 120,00':'Ex.: 120'}/></label>
   <label>Motivo da alteração<textarea value={reason} onChange={event=>{setReason(event.target.value);setReviewed(false);}} required/></label>
   <label>Origem da autorização<input value={source} onChange={event=>{setSource(event.target.value);setReviewed(false);}} required/></label>
   <label>Evidência da autorização<textarea value={evidence} onChange={event=>{setEvidence(event.target.value);setReviewed(false);}} required/></label>
   <label><input type="checkbox" checked={reviewed} onChange={event=>setReviewed(event.target.checked)}/> Conferi o novo limite, a moeda e a autorização de gasto registrada.</label>
   <button disabled={command.pending||!reviewed||!ceiling.trim()||!reason.trim()||!source.trim()||!evidence.trim()}>Registrar novo limite</button>
   {(error||command.error)&&<p role="alert">{error??command.error}</p>}{saved&&<p role="status">Alteração registrada. Confira as pendências e as cotações antes de continuar.</p>}
  </form></details>
 </section>;
}
