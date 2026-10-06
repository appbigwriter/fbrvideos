import type {SqlDatabase} from './configuration-store.js';

export class OperationalTelemetry{
  private readonly started=Date.now();
  private readonly counters=new Map<string,{count:number;errors:number;total_ms:number;max_ms:number}>();
  observe(method:string,route:string,status:number,elapsed:number){
    const key=`${method} ${route}`,value=this.counters.get(key)??{count:0,errors:0,total_ms:0,max_ms:0};
    const ms=Math.max(0,Number.isFinite(elapsed)?elapsed:0);value.count++;value.errors+=status>=500?1:0;value.total_ms+=ms;value.max_ms=Math.max(value.max_ms,ms);
    if(this.counters.size<200||this.counters.has(key))this.counters.set(key,value);
  }
  snapshot(){return {uptime_seconds:Math.floor((Date.now()-this.started)/1000),routes:[...this.counters].map(([route,value])=>({route,...value,mean_ms:value.total_ms/value.count}))};}
}
export async function operationalState(db:SqlDatabase){
  // Apenas agregados; parâmetros de geração, fontes, storage e credenciais não entram no relatório.
  const productions=(await db.query("SELECT r.record->>'status' AS status,count(*)::integer AS count FROM production_revisions r JOIN production_heads h USING(id,version) GROUP BY r.record->>'status' ORDER BY status")).rows;
  const jobs=(await db.query("SELECT r.record->>'state' AS state,count(*)::integer AS count FROM generation_revisions r JOIN generation_heads h USING(id,version) GROUP BY r.record->>'state' ORDER BY state")).rows;
  const interrupted=(await db.query("SELECT count(*)::integer AS count FROM assembly_runs WHERE state='running' AND started_at<CURRENT_TIMESTAMP-INTERVAL '3 minutes'")).rows[0]?.count??0;
  return {database:'ready',productions,jobs,interrupted_assemblies:Number(interrupted),attention_required:jobs.some(row=>row.state==='unknown')||Number(interrupted)>0};
}
