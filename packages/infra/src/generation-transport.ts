import { PgBoss } from 'pg-boss';
import { IdSchema, type GenerationQueue, type GenerationAdapter } from '@fbr/contracts';
import { GenerationWorker } from '@fbr/pipeline';
import type { SqlDatabase } from './configuration-store.js';

const queueName = 'fbr-generation';
/** pg-boss transporta IDs; intenção, custos e fencing permanecem no journal da aplicação. */
export class GenerationTransport {
  readonly boss: PgBoss;
  private readonly worker: GenerationWorker;
  private readonly adapterIds:string[];
  private readonly recoverableIds:string[]=[];
  constructor(connectionString: string, private readonly db: SqlDatabase, private readonly queue: GenerationQueue,
    private readonly adapters: ReadonlyMap<string, GenerationAdapter>, schema = 'pgboss', onError: () => void = () => console.error('Falha no transporte de geração; verificar o estado persistido.'),
    admitReal?:ConstructorParameters<typeof GenerationWorker>[2],private readonly advance?:(productionId:string)=>Promise<void>) {
    if (!/^[a-z][a-z0-9_]*$/.test(schema)) throw new Error('generation_transport_schema_invalid');
    this.boss = new PgBoss({ connectionString, schema });
    this.boss.on('error', onError);
    this.worker = new GenerationWorker(queue, adapters,admitReal);this.adapterIds=[...adapters.keys()];
  }
  async start(consume = true) {
    this.recoverableIds.length=0;
    for(const [id,adapter]of this.adapters)if((await adapter.capabilities()).supports_idempotent_recovery&&adapter.recover)this.recoverableIds.push(id);
    await this.boss.start();
    await this.boss.createQueue(queueName, { policy: 'exclusive', retryLimit: 3, retryDelay: 5,
      retryBackoff: true, expireInSeconds: 90 });
    if (consume) await this.boss.work<{ execution_id: string }>(queueName, { batchSize: 1 }, async jobs => {
      for (const job of jobs) await this.process(job.data);
    });
  }
  async process(data: { execution_id: string }) {
    const id = IdSchema.parse(data.execution_id), execution = await this.queue.get(id);
    if (!execution) throw new Error('generation_execution_not_found');
    const result = await this.db.query('SELECT r.record FROM production_revisions r JOIN production_heads h USING(id,version) WHERE h.id=$1', [execution.intent.request.production.id]);
    const production = result.rows[0]?.record as { status: string } | undefined;
    const next=await (production?.status === 'cancelled' ? this.worker.cancel(id) : this.worker.run(id));
    if(next.state==='succeeded'&&this.advance)await this.advance(execution.intent.request.production.id);
    return next;
  }
  async dispatchPending(productionId: string | null = null) {
    const result = await this.db.query(`SELECT h.id FROM generation_heads h
      JOIN generation_revisions r USING(id,version)
      JOIN production_heads p ON p.id=h.production_id
      JOIN production_revisions pr ON pr.id=p.id AND pr.version=p.version
      WHERE ($1::text IS NULL OR h.production_id=$1)
      AND r.record->'intent'->>'adapter_id'=ANY($2::text[])
      AND (r.record->>'lease_until' IS NULL OR (r.record->>'lease_until')::timestamptz<=CURRENT_TIMESTAMP)
      AND ((r.record->>'state'='prepared' AND pr.record->>'status' IN ('preparing','awaiting_decision','producing','correcting','cancelled'))
        OR r.record->>'state' IN ('active','submitting')
        OR (r.record->>'state'='unknown' AND (r.record->'provider_job'->>'external_job_id' IS NOT NULL OR r.record->'intent'->>'adapter_id'=ANY($3::text[]))))
      ORDER BY h.id LIMIT 100`, [productionId,this.adapterIds,this.recoverableIds]);
    let sent = 0;
    for (const row of result.rows) if (await this.boss.send(queueName, { execution_id: String(row.id) }, { singletonKey: String(row.id) })) sent++;
    return sent;
  }
  async stop() { await this.boss.stop({ graceful: true, timeout: 10000 }); }
}
