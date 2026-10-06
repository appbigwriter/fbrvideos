import type { InferenceJournal,InferenceResult } from '@fbr/contracts';
import type { SqlDatabase } from './configuration-store.js';
export class PostgresInferenceJournal implements InferenceJournal {
  constructor(private readonly db:SqlDatabase) {}
  async run(key:string,fingerprint:string,infer:()=>Promise<InferenceResult>):Promise<InferenceResult> {
    const inserted=await this.db.query("INSERT INTO planning_inferences(execution_key,fingerprint,state) VALUES ($1,$2,'running') ON CONFLICT DO NOTHING RETURNING execution_key",[key,fingerprint]);
    if(inserted.rowCount!==1){
      const row=(await this.db.query('SELECT fingerprint,state,result,started_at FROM planning_inferences WHERE execution_key=$1',[key])).rows[0]!;
      if(row.fingerprint!==fingerprint)throw new Error('oauth_execution_conflict');
      if(row.state==='completed')return row.result as unknown as InferenceResult;
      if(row.state==='running'&&Date.now()-new Date(String(row.started_at)).getTime()<240_000)throw new Error('oauth_execution_busy');
      throw new Error('oauth_execution_unknown');
    }
    try {
      const cached=(await this.db.query("SELECT execution_key,result FROM planning_inferences WHERE fingerprint=$1 AND state='completed' ORDER BY started_at DESC LIMIT 1",[fingerprint])).rows[0];
      const result:InferenceResult=cached?{...cached.result as unknown as InferenceResult,reused:true,source_execution_key:String(cached.execution_key)}:await infer();
      await this.db.query("UPDATE planning_inferences SET state='completed',result=$2::jsonb WHERE execution_key=$1 AND state='running'",[key,JSON.stringify(result)]);
      return result;
    } catch(error) {
      await this.db.query("UPDATE planning_inferences SET state='failed' WHERE execution_key=$1 AND state='running'",[key]);throw error;
    }
  }
}
