import { randomUUID } from 'node:crypto';
import { GenerationIntentSchema, GenerationExecutionSchema, ProductionSchema, ProductionSnapshotSchema,
  JobSchema, type GenerationExecution, type GenerationQueue, type Production,type GenerationAdmission } from '@fbr/contracts';
import { ApplicationError, budgetPreflight, canonical, sha256 } from '@fbr/domain';
import type { SqlClient, SqlDatabase } from './configuration-store.js';

const terminal = (state: GenerationExecution['state']) => ['succeeded', 'failed', 'cancelled'].includes(state);
async function executions(client: SqlClient, productionId: string) {
  const result = await client.query('SELECT r.record FROM generation_revisions r JOIN generation_heads h USING(id,version) WHERE h.production_id=$1 ORDER BY h.id', [productionId]);
  return result.rows.map(row => GenerationExecutionSchema.parse(row.record));
}
async function execution(client: SqlClient, id: string) {
  const row = (await client.query('SELECT r.record FROM generation_revisions r JOIN generation_heads h USING(id,version) WHERE h.id=$1', [id])).rows[0];
  return row ? GenerationExecutionSchema.parse(row.record) : null;
}
async function lockProduction(client: SqlClient, id: string): Promise<Production> {
  const head = (await client.query('SELECT version FROM production_heads WHERE id=$1 FOR UPDATE', [id])).rows[0];
  if (!head) throw new ApplicationError('not_found', 'Produção não encontrada.');
  const row = (await client.query('SELECT record FROM production_revisions WHERE id=$1 AND version=$2', [id, head.version])).rows[0]!;
  return ProductionSchema.parse(row.record);
}
async function append(client: SqlClient, record: GenerationExecution) {
  await client.query('INSERT INTO generation_revisions(id,version,record) VALUES($1,$2,$3::jsonb)', [record.id, record.version, JSON.stringify(record)]);
  await client.query('UPDATE generation_heads SET version=$2 WHERE id=$1', [record.id, record.version]);
}
async function updateCosts(client: SqlClient, production: Production) {
  const jobs = await executions(client, production.id);
  const costs = { ...production.costs,
    committed_minor: jobs.reduce((sum, job) => sum + job.reserved_minor, 0),
    confirmed_minor: jobs.reduce((sum, job) => sum + job.confirmed_minor, 0),
    estimated_minor: jobs.reduce((sum, job) => sum + job.intent.estimate.upper_minor, 0) };
  if (canonical(costs) === canonical(production.costs)) return;
  const at = new Date().toISOString(), message = 'Compromissos e custos da fila reconciliados; estimativa não é cobrança.';
  const overrun=costs.confirmed_minor+costs.committed_minor+costs.safety_margin_minor>costs.ceiling_minor;
  const issues=production.pending_issues.filter(issue=>issue.code!=='budget_reconciliation_overrun');
  if(overrun)issues.push({code:'budget_reconciliation_overrun',message:'Cobrança ou reserva reconciliada ultrapassa o saldo seguro do orçamento.',next_action:'Conferir lançamentos e limite antes de novos trabalhos ou entrega.',required:true});
  const record = ProductionSchema.parse({ ...production, costs, version: production.version + 1, created_at: at,
    pending_issues:issues,...(overrun&&['approved','exported'].includes(production.status)?{status:'awaiting_decision',current_approval:null}:{}),
    changes: [...production.changes, { at, author: 'generation_queue', reason: message }] });
  await client.query('INSERT INTO production_revisions(id,version,record) VALUES($1,$2,$3::jsonb)', [record.id, record.version, JSON.stringify(record)]);
  await client.query('UPDATE production_heads SET version=$2 WHERE id=$1', [record.id, record.version]);
  const eventId = randomUUID();
  await client.query('INSERT INTO production_events(id,production_id,version,record) VALUES($1,$2,$3,$4::jsonb)',
    [eventId, record.id, record.version, JSON.stringify({ id: eventId, production: { id: record.id, version: record.version }, at, type: 'costs_updated', message })]);
}

/** Núcleo S3 exercitável sem abrir os gates de geração real. */
export class PostgresGenerationQueue implements GenerationQueue {
  constructor(private readonly db: SqlDatabase,private readonly admission?:GenerationAdmission) {}
  get(id: string) { return execution(this.db, id); }
  list(productionId: string) { return executions(this.db, productionId); }
  async enqueue(raw: unknown) {
    return this.db.transaction(client=>this.enqueueWithin(client,raw));
  }
  /** Mesmo commit do plano de correção; nenhuma intenção aparece parcialmente publicada. */
  async enqueueBatchWithin(client:SqlClient,raw:unknown[]){
    if(!raw.length||raw.length>100||new Set(raw.map(value=>GenerationIntentSchema.parse(value).request.production.id)).size!==1)
      throw new ApplicationError('validation','Batch exige operações limitadas da mesma produção.');
    const records=[];
    for(const intent of raw)records.push(await this.enqueueWithin(client,intent,true));
    if(records.length)await updateCosts(client,await lockProduction(client,records[0]!.intent.request.production.id));
    return records;
  }
  private async enqueueWithin(client:SqlClient,raw:unknown,deferCosts=false){
    const intent = GenerationIntentSchema.parse(raw), request = intent.request;
    // A liberação de adapters reais requer o piloto e será ligada em S3-C01.
    const fingerprint = sha256(canonical(intent));
      const production = await lockProduction(client, request.production.id);
      const previous = (await client.query('SELECT id,fingerprint,production_id FROM generation_heads WHERE execution_key=$1 AND attempt=$2', [request.execution_key, request.attempt])).rows[0];
      if (previous) {
        if (previous.production_id !== production.id || previous.fingerprint !== fingerprint)
          throw new ApplicationError('conflict', 'Chave de execução já utilizada com outra intenção.');
        return (await execution(client, String(previous.id)))!;
      }
      if(!intent.adapter_id.startsWith('sim_')&&(!this.admission||!await this.admission(intent,production)))
        throw new ApplicationError('ineligible','Adapter real exige liberação server-side da conta, perfil e custo.');
      if (request.production.version !== production.version) throw new ApplicationError('conflict', 'Revisão da produção desatualizada.');
      if (!['preparing', 'awaiting_decision', 'producing','correcting'].includes(production.status))
        throw new ApplicationError('ineligible', 'Produção não permite novos jobs.');
      const snapshot = ProductionSnapshotSchema.parse((await client.query('SELECT record FROM production_snapshots WHERE production_id=$1', [production.id])).rows[0]?.record);
      const budget = snapshot.profile.budget!;
      if (request.currency !== budget.currency) throw new ApplicationError('validation', 'Moeda da estimativa difere do orçamento.');
      if (request.attempt > budget.max_attempts_per_job) throw new ApplicationError('attempts_exceeded', 'Limite de tentativas atingido.');
      const jobs = await executions(client, production.id);
      const earlier = jobs.filter(job => job.intent.request.execution_key === request.execution_key);
      const last = earlier.sort((a, b) => b.intent.request.attempt - a.intent.request.attempt)[0];
      if (request.attempt !== (last?.intent.request.attempt ?? 0) + 1 || (last && !['failed', 'cancelled'].includes(last.state)))
        throw new ApplicationError('conflict', 'Nova tentativa exige falha ou cancelamento reconciliado da anterior.');
      if (jobs.some(job => job.state === 'unknown')) throw new ApplicationError('provider_unknown', 'Custo incerto: reconciliar antes de reservar novo gasto.');
      const committed = jobs.reduce((sum, job) => sum + job.reserved_minor, 0);
      const confirmed = jobs.reduce((sum, job) => sum + job.confirmed_minor, 0);
      if (budgetPreflight({ ...production.costs, committed_minor: committed, confirmed_minor: confirmed }, intent.estimate.upper_minor).length)
        throw new ApplicationError('budget_exceeded', 'Reserva excede o orçamento com margem de segurança.');
      const record = GenerationExecutionSchema.parse({ id: randomUUID(), version: 1, intent, state: 'prepared',
        reserved_minor: request.reserved_minor, confirmed_minor: 0, provider_job: null, diagnostic: null, lease_token: null, lease_until: null });
      await client.query('INSERT INTO generation_heads(id,production_id,execution_key,attempt,fingerprint,version) VALUES($1,$2,$3,$4,$5,1)',
        [record.id, production.id, request.execution_key, request.attempt, fingerprint]);
      await append(client, record);
      if(!deferCosts)await updateCosts(client, production);
      return record;
  }
  private async change(id: string, run: (client: SqlClient, current: GenerationExecution, production: Production) => Promise<GenerationExecution | null>) {
    const head = (await this.db.query('SELECT production_id FROM generation_heads WHERE id=$1', [id])).rows[0];
    if (!head) throw new ApplicationError('not_found', 'Execução não encontrada.');
    return this.db.transaction(async client => {
      const production = await lockProduction(client, String(head.production_id));
      const current = (await execution(client, id))!;
      const next = await run(client, current, production);
      if (!next) return null;
      const record = GenerationExecutionSchema.parse({ ...next, version: current.version + 1 });
      await append(client, record);
      await updateCosts(client, production);
      return record;
    });
  }
  async claim(id: string, leaseSeconds = 60,allowIdempotentRecovery=false) {
    if (!Number.isInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 300) throw new ApplicationError('validation', 'Lease inválido.');
    return this.change(id, async (client, current, production) => {
      if (terminal(current.state)) return null;
      const { now } = (await client.query('SELECT CURRENT_TIMESTAMP AS now', [])).rows[0]!;
      const time = new Date(String(now));
      if (current.lease_until && new Date(current.lease_until) > time) return null;
      if (current.state === 'unknown' && !current.provider_job?.external_job_id&&!allowIdempotentRecovery) return null;
      if (current.state === 'submitting') {
        return { ...current, state: 'unknown', diagnostic: 'Envio ambíguo; consulta por chave necessária. Não reenviar.', lease_token: null, lease_until: null };
      }
      if (current.state === 'prepared' && !['preparing', 'awaiting_decision', 'producing','correcting'].includes(production.status)) return null;
      return { ...current, state: current.state === 'prepared' ? 'submitting' : current.state,
        lease_token: randomUUID(), lease_until: new Date(time.getTime() + leaseSeconds * 1000).toISOString() };
    });
  }
  private checkLease(current: GenerationExecution, token: string) {
    if (!current.lease_token || current.lease_token !== token) throw new ApplicationError('conflict', 'Worker perdeu a posse desta execução.');
  }
  async complete(id: string, token: string, raw: unknown) {
    const job = JobSchema.parse(raw);
    return (await this.change(id, async (_client, current) => {
      this.checkLease(current, token);
      const request = current.intent.request;
      if (job.execution_key !== request.execution_key || job.attempt !== request.attempt || job.production.id !== request.production.id
        || job.production.version !== request.production.version || job.configuration_hash !== request.configuration_hash
        || job.stage !== request.operation || job.costs.currency !== request.currency
        || canonical(job.sent_parameters) !== canonical(request.parameters) || canonical(job.inputs) !== canonical(request.input_assets)
        || (current.provider_job && (current.provider_job.id !== job.id || current.provider_job.external_job_id !== job.external_job_id)))
        throw new ApplicationError('conflict', 'Resultado não pertence à intenção persistida.');
      if (current.provider_job && job.version < current.provider_job.version) throw new ApplicationError('conflict', 'Resultado externo desatualizado.');
      if (current.provider_job && job.version === current.provider_job.version && canonical(job) !== canonical(current.provider_job))
        throw new ApplicationError('conflict', 'Mesma revisão externa com dados divergentes.');
      const done = ['succeeded', 'failed', 'cancelled'].includes(job.status);
      const knownCost = job.costs.confirmed_minor !== null;
      const state = done && knownCost ? job.status as GenerationExecution['state']
        : job.status === 'unknown' || (done && !knownCost) ? 'unknown' : 'active';
      const confirmed = job.costs.confirmed_minor ?? current.confirmed_minor;
      return { ...current, provider_job: job, state, confirmed_minor: confirmed,
        reserved_minor: done && knownCost ? 0 : Math.max(0, request.reserved_minor - confirmed),
        diagnostic: state === 'unknown' ? 'Resultado ou cobrança incertos; reserva conservada.' : null,
        lease_token: null, lease_until: null };
    }))!;
  }
  async uncertain(id: string, token: string, diagnostic: string) {
    return (await this.change(id, async (_client, current) => {
      this.checkLease(current, token);
      return { ...current, state: 'unknown', diagnostic, lease_token: null, lease_until: null };
    }))!;
  }
  async cancelPrepared(id: string) {
    const changed = await this.change(id, async (_client, current) => {
      if (current.state === 'cancelled') return null;
      if (current.state !== 'prepared') throw new ApplicationError('conflict', 'Execução enviada exige reconciliação externa.');
      return { ...current, state: 'cancelled', reserved_minor: 0, diagnostic: 'Cancelado antes do envio.' };
    });
    return changed ?? (await this.get(id))!;
  }
}
