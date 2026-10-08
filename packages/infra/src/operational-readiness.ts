import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import type {SqlDatabase} from './configuration-store.js';
const execute=promisify(execFile);
const requiredTables=['configuration_heads','production_heads','generation_heads','media_heads','assembly_runs','provider_http_intents','calibration_observations','calibration_profile_decisions','provider_normalized_receipts','provider_quotes','pipeline_commands','source_edit_audits','production_budget_commands','assembly_evidence','generation_polls','operational_samples'];
/** Checks operacionais sanitizados; liveness de processo é independente de readiness. */
export async function operationalReadiness(db:SqlDatabase,probeRenderer=true){
 const checks:{component:string;ready:boolean;diagnostic:string|null}[]=[];
 try{
  const rows=(await db.query('SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name=ANY($1::text[])',[requiredTables])).rows;
  const tables=new Set(rows.map(row=>row.table_name));
  checks.push({component:'database',ready:true,diagnostic:null});
  const missing=requiredTables.filter(table=>!tables.has(table));
  checks.push({component:'migrations',ready:missing.length===0,diagnostic:missing.length?'required_tables_missing':null});
 }catch{checks.push({component:'database',ready:false,diagnostic:'database_unavailable'});}
 if(probeRenderer){for(const executable of ['ffmpeg','ffprobe']){
  try{await execute(executable,['-version'],{timeout:5000,maxBuffer:32768,windowsHide:true});checks.push({component:executable,ready:true,diagnostic:null});}
  catch{checks.push({component:executable,ready:false,diagnostic:'media_tool_unavailable'});}
 }}return {ready:checks.every(check=>check.ready),checked_at:new Date().toISOString(),checks};
}
