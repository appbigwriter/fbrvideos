import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { ArticleSchema, ProfileSchema, CharacterSchema, ReferenceSchema, GenerationListSchema,ProductionSchema, type AdapterResult, type GenerationIntent, type GenerationExecution, type Job } from '@fbr/contracts';
import { buildApp } from '../../../apps/api/src/app.js';
import { fixtureDelivery, imageFixture, audioFixture, imageEvaluationFixture, audioEvaluationFixture, timelineFixture } from '@fbr/contracts/fixtures';
import { ConfigurationService, ProductionService, sha256 } from '@fbr/domain';
import { GenerationWorker, SimulatedGenerationAdapter, getPipelineCatalog } from '@fbr/pipeline';
import {PostgresBudgetWorkflow} from '../src/budget-workflow.js';
import {reconcileSettledInvoices} from '../src/provider-callback-inbox.js';
import { PostgresDatabase, PostgresConfigurationStore, PostgresProductionStore, PostgresGenerationQueue,
  GenerationTransport, PostgresMediaStore, LocalImmutableAssetStore, captureMetadataBackup, restoreMetadataBackup,
  migrateConfiguration, type SqlClient, type SqlDatabase } from '../src/index.js';

let db: SqlDatabase, close: () => Promise<void>, queue: PostgresGenerationQueue, productions: ProductionService;
before(async () => {
  if (process.env.TEST_DATABASE_URL) { const pg = new PostgresDatabase(process.env.TEST_DATABASE_URL); db = pg; close = () => pg.close(); }
  else {
    const engine = new PGlite();
    const wrap = (client: Pick<PGlite, 'query' | 'exec'>): SqlClient => ({ async query(sql, values) {
      if (values === undefined) { const result = (await client.exec(sql)).at(-1); return { rows: result?.rows as Record<string, unknown>[] ?? [], rowCount: result?.affectedRows ?? 0 }; }
      const result = await client.query<Record<string, unknown>>(sql, values); return { rows: result.rows, rowCount: result.affectedRows ?? 0 };
    } });
    db = { ...wrap(engine), transaction: run => engine.transaction(tx => run(wrap(tx))) }; close = () => engine.close();
  }
  await migrateConfiguration(db); queue = new PostgresGenerationQueue(db);
  productions = new ProductionService(new PostgresProductionStore(db), getPipelineCatalog());
});
after(async () => close?.());
async function source() {
  const configuration = new ConfigurationService(new PostgresConfigurationStore(db));
  const save = (data: unknown) => ({ command_id: randomUUID(), expected_version: null, reason: 'Teste sintético S3', data });
  const voice = ReferenceSchema.parse(await configuration.save('references', save({ name: 'Voz sintética S3', kind: 'voice', status: 'pending', asset_refs: [], rules: [], usage_permission: 'unknown' })));
  const character = CharacterSchema.parse(await configuration.save('characters', save({ name: 'Personagem S3', status: 'confirmed', bible_original: '# Bible sintético', interpretation: 'Teste', interpretation_confirmed: true, references: [], voice: { id: voice.id, version: 1 }, authorized_variations: [] })));
  const article = ArticleSchema.parse(await configuration.save('articles', save({ title: 'Artigo S3', source_author: 'Autora sintética', content: 'Notificações interrompem tarefas.', complete: true, character: { id: character.id, version: 1 } })));
  const profile = ProfileSchema.parse(await configuration.save('profiles', save({ name: 'Perfil S3', status: 'calibrating', character: { id: character.id, version: 1 }, language: 'pt-BR', target_seconds: 8, recipe: 'explanation', voice: { id: voice.id, version: 1 }, permitted_shot_classes: ['editorial_illustration'], permitted_references: [], delivery: fixtureDelivery, budget: { currency: 'BRL', ceiling_minor: 1000, safety_margin_minor: 100, max_attempts_per_job: 2 }, calibration_scope: null })));
  return productions.create({ contract_version: '0.1.0', command_id: randomUUID(), article: { id: article.id, version: 1 }, profile: { id: profile.id, version: 1 }, name: 'Produção S3 sintética', mode: 'calibration' });
}
async function intent(id: string, amount = 100, key = sha256(randomUUID()), attempt = 1): Promise<GenerationIntent> {
  const production = (await productions.detail(id)).production;
  return { adapter_id: 'sim_audio', estimate: { currency: 'BRL', upper_minor: amount, evidence: 'Estimativa sintética, sem cobrança.' },
    request: { contract_version: '0.1.0', production: { id, version: production.version }, execution_key: key, attempt,
      shot: null, operation: 'audio', route: null, input_assets: [], references: [], configuration_hash: sha256('config'),
      parameters: { text: 'Texto sintético', voice_reference: 'voice_fixture' }, currency: 'BRL', reserved_minor: amount } };
}
async function accepted(record: GenerationExecution): Promise<Job> {
  const result = await new SimulatedGenerationAdapter('audio').submit(record.intent.request);
  assert.equal(result.outcome, 'accepted'); if (result.outcome !== 'accepted') throw new Error('blocked'); return result.job;
}

test('Fatura terminal posterior e reembolso conservam output, invalidam aprovação financeira e permitem nova revisão',async()=>{
  const p=await source(),record=await queue.enqueue(await intent(p.id,100));
  const claimed=await queue.claim(record.id);assert.ok(claimed?.lease_token);
  const base={...await accepted(record),status:'succeeded' as const,costs:{currency:'BRL',estimated_minor:100,committed_minor:100,confirmed_minor:100}};
  await queue.complete(record.id,claimed.lease_token,base);
  const current=(await productions.detail(p.id)).production;
  const approved=ProductionSchema.parse({...current,version:current.version+1,status:'approved',stage:'delivery',pending_issues:[],current_render:{id:'synthetic_review_render',version:1},current_approval:{id:'synthetic_final_approval',version:1}});
  await db.transaction(async client=>{await client.query('INSERT INTO production_revisions(id,version,record) VALUES($1,$2,$3::jsonb)',[approved.id,approved.version,JSON.stringify(approved)]);await client.query('UPDATE production_heads SET version=$2 WHERE id=$1',[approved.id,approved.version]);});
  const billed={...base,version:2,costs:{...base.costs,confirmed_minor:1200}};
  const invoice=await queue.reconcileBilling(record.id,billed);assert.equal(invoice.confirmed_minor,1200);
  const blocked=(await productions.detail(p.id)).production;assert.equal(blocked.status,'ready_for_review');assert.equal(blocked.stage,'review');assert.equal(blocked.current_approval,null);
  assert.ok(blocked.pending_issues.some(i=>i.code==='budget_reconciliation_overrun'));
  const refund={...billed,version:3,costs:{...billed.costs,confirmed_minor:90}};
  const reconciled=await queue.reconcileBilling(record.id,refund);assert.equal(reconciled.state,'succeeded');assert.equal(reconciled.reserved_minor,0);assert.equal(reconciled.confirmed_minor,90);
  const ready=(await productions.detail(p.id)).production;assert.equal(ready.status,'ready_for_review');assert.equal(ready.current_approval,null);assert.equal(ready.pending_issues.length,0);
  const replay=await queue.reconcileBilling(record.id,refund);assert.equal(replay.version,reconciled.version);
  await assert.rejects(queue.reconcileBilling(record.id,{...refund,version:4,costs:{...refund.costs,confirmed_minor:null}}),/não confirmada/);
  await assert.rejects(queue.reconcileBilling(record.id,billed),/desatualizado/);
  await assert.rejects(queue.reconcileBilling(record.id,{...refund,version:4,production:{id:'other_production',version:1}}),/intenção/);
  await assert.rejects(queue.reconcileBilling(record.id,{...refund,version:4,output_assets:[{id:'foreign_output',version:1}]}),/output/);
  await assert.rejects(queue.reconcileBilling(record.id,{...refund,version:4,costs:{...refund.costs,currency:'USD'}}),/intenção/);
});

test('Revisão explícita do teto preserva cobranças e registra evidência, CAS e replay',async()=>{
  await db.query(await readFile(new URL('../migrations/014_budget.sql',import.meta.url),'utf8'));
  const p=await source(),current=(await productions.detail(p.id)).production,budget=new PostgresBudgetWorkflow(db);
  const command={command_id:randomUUID(),production:{id:p.id,version:current.version},currency:'BRL',ceiling_minor:2000,reason:'Ensaio da revisão financeira',source:'fixture_budget_owner',evidence:'Evidência exclusivamente sintética; não autoriza gasto real.',reviewed:true};
  await assert.rejects(budget.revise({...command,reviewed:false}));
  const raised=await budget.revise(command);assert.equal(raised.costs.ceiling_minor,2000);assert.equal(raised.costs.confirmed_minor,current.costs.confirmed_minor);
  assert.deepEqual(await new PostgresBudgetWorkflow(db).revise(command),raised);
  await assert.rejects(budget.revise({...command,ceiling_minor:3000}),/reutilizado/);
  await assert.rejects(budget.revise({...command,command_id:randomUUID(),ceiling_minor:3000}),/alterada/);
  await assert.rejects(budget.revise({...command,command_id:randomUUID(),production:{id:p.id,version:raised.version},currency:'USD',ceiling_minor:3000}),/Moeda/);
  const audit=(await db.query('SELECT record FROM production_budget_commands WHERE command_id=$1',[command.command_id])).rows[0]?.record as {evidence:string;previous_ceiling_minor:number};
  assert.equal(audit.evidence,command.evidence);assert.equal(audit.previous_ceiling_minor,1000);
});

test('Reconciliação periódica de faturas terminais consulta adapter liberado sem novo envio',async()=>{
  const p=await source(),granted=new PostgresGenerationQueue(db,async()=>true),proposed={...await intent(p.id,100),adapter_id:'invoice_audio'};
  const execution=await granted.enqueue(proposed),claimed=await granted.claim(execution.id);assert.ok(claimed?.lease_token);
  const base={...await accepted(execution),status:'succeeded' as const,costs:{currency:'BRL',estimated_minor:100,committed_minor:100,confirmed_minor:100}};
  await granted.complete(execution.id,claimed.lease_token,base);
  let queries=0,sends=0;
  class InvoiceAdapter extends SimulatedGenerationAdapter{
    override async capabilities(){const caps=await super.capabilities();return{...caps,adapter_id:'invoice_audio',mode:'real' as const,evidence_refs:['offline_invoice_contract']};}
    override async submit(request:GenerationIntent['request']){sends++;return super.submit(request);}
    override async query(id:string):Promise<AdapterResult>{queries++;assert.equal(id,base.external_job_id);return{outcome:'accepted',job:{...base,version:2,costs:{...base.costs,confirmed_minor:70}}};}
  }
  const registry=new Map([['invoice_audio',new InvoiceAdapter('audio')]]);
  assert.deepEqual(await reconcileSettledInvoices(granted,registry,[p.id],async()=>false),{checked:0,pending:1});assert.equal(queries,0);
  assert.deepEqual(await reconcileSettledInvoices(granted,registry,[p.id],async()=>true),{checked:1,pending:0});assert.equal(queries,1);assert.equal(sends,0);
  assert.equal((await granted.get(execution.id))?.confirmed_minor,70);
});
test('Reserva concorrente é atômica, replay persiste e outra intenção não reutiliza a chave', async () => {
  const p = await source(), a = await intent(p.id, 600), b = await intent(p.id, 600);
  const results = await Promise.allSettled([queue.enqueue(a), queue.enqueue(b)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const first = results.find(r => r.status === 'fulfilled'); assert.ok(first?.status === 'fulfilled');
  const record = first.value;
  assert.deepEqual(await new PostgresGenerationQueue(db).enqueue(record.intent), record);
  assert.equal((await productions.detail(p.id)).production.costs.committed_minor, 600);
  await assert.rejects(queue.enqueue({ ...record.intent, request: { ...record.intent.request, parameters: { text: 'Mudança', voice_reference: 'voice_fixture' } } }), /outra intenção/);
  await assert.rejects(queue.enqueue(await intent(p.id, 400)), /orçamento/);
  await assert.rejects(db.query('UPDATE generation_revisions SET record=record WHERE id=$1', [record.id]), /Immutable/);
});
test('Adapter real provisionado exige liberação independente na reserva e no worker',async()=>{
  const p=await source(),base=await intent(p.id,0),planned={...base,adapter_id:'future_audio'};
  await assert.rejects(queue.enqueue(planned),/liberação server-side/);
  const granted=new PostgresGenerationQueue(db,async candidate=>candidate.adapter_id==='future_audio');
  const execution=await granted.enqueue(planned);
  class FutureAdapter extends SimulatedGenerationAdapter{override async capabilities(){const caps=await super.capabilities();return {...caps,adapter_id:'future_audio',mode:'real' as const,evidence_refs:['schema_fixture']};}}
  const adapter=new FutureAdapter('audio'),registry=new Map([['future_audio',adapter]]);
  await assert.rejects(new GenerationWorker(granted,registry).run(execution.id),/real_gate_pending/);
  assert.equal((await granted.get(execution.id))!.state,'prepared');
  await new GenerationWorker(granted,registry,async()=>true).run(execution.id);
  assert.equal((await granted.get(execution.id))!.state,'active');
});
test('Workers concorrentes enviam uma vez e reinício consulta job existente; callbacks duplicados não enviam', async () => {
  const p = await source(), record = await queue.enqueue(await intent(p.id));
  class CountingAdapter extends SimulatedGenerationAdapter { calls = 0; override async submit(request: GenerationIntent['request']) { this.calls++; return super.submit(request); } }
  const adapter = new CountingAdapter('audio');
  const worker = () => new GenerationWorker(new PostgresGenerationQueue(db), new Map([['sim_audio', adapter]]));
  await Promise.all([worker().run(record.id), worker().run(record.id)]);
  assert.equal(adapter.calls, 1);
  await worker().reconcileCallback(record.id); await worker().reconcileCallback(record.id);
  const final = (await queue.get(record.id))!;
  assert.equal(final.state, 'succeeded'); assert.equal(final.reserved_minor, 0); assert.equal(final.confirmed_minor, 0);
  await worker().run(record.id); assert.equal(adapter.calls, 1);
  const costs = (await productions.detail(p.id)).production.costs; assert.equal(costs.committed_minor, 0); assert.equal(costs.confirmed_minor, 0);
});
test('Recuperação explícita repete a identidade idempotente e conserva reserva após recibo perdido',async()=>{
  const p=await source(),execution=await queue.enqueue(await intent(p.id,100));
  class Recoverable extends SimulatedGenerationAdapter{
    sends=0;recoveries=0;
    override async capabilities(){const caps=await super.capabilities();return {...caps,supports_idempotent_recovery:true};}
    override async submit(request:GenerationIntent['request']):Promise<AdapterResult>{this.sends++;await super.submit(request);throw new Error('receipt lost');}
    async recover(request:GenerationIntent['request']){this.recoveries++;return super.submit(request);}
  }
  const adapter=new Recoverable('audio'),worker=new GenerationWorker(queue,new Map([['sim_audio',adapter]]));
  await worker.run(execution.id);assert.equal((await queue.get(execution.id))!.state,'unknown');assert.equal((await queue.get(execution.id))!.reserved_minor,100);
  await worker.run(execution.id);assert.equal(adapter.sends,1);assert.equal(adapter.recoveries,1);assert.equal((await queue.get(execution.id))!.state,'active');
});
test('Cobrança acima do limite persiste como impedimento e bloqueia novas reservas',async()=>{
  const p=await source(),execution=await queue.enqueue(await intent(p.id,100)),job=await accepted(execution),claimed=await queue.claim(execution.id);
  await queue.complete(execution.id,claimed!.lease_token!,{...job,status:'succeeded',costs:{...job.costs,committed_minor:0,confirmed_minor:1100}});
  const changed=(await productions.detail(p.id)).production;assert.equal(changed.costs.confirmed_minor,1100);
  assert.ok(changed.pending_issues.some(issue=>issue.code==='budget_reconciliation_overrun'));
  await assert.rejects(queue.enqueue(await intent(p.id,0)),/orçamento/);
});
test('Crash após envio conserva reserva e não reenvia; posse do worker é cercada pelo token', async () => {
  const p = await source(), record = await queue.enqueue(await intent(p.id, 300));
  const claimed = (await queue.claim(record.id, 1))!; assert.ok(claimed.lease_token);
  const expired = { ...claimed, lease_until: '2000-01-01T00:00:00Z' };
  // Simula passagem de tempo sem esperar: nova revisão preserva o histórico anterior.
  await db.query('INSERT INTO generation_revisions(id,version,record) VALUES($1,$2,$3::jsonb)', [expired.id, expired.version + 1, JSON.stringify({ ...expired, version: expired.version + 1 })]);
  await db.query('UPDATE generation_heads SET version=$2 WHERE id=$1', [expired.id, expired.version + 1]);
  const recovered = await queue.claim(record.id); assert.equal(recovered?.state, 'unknown');
  assert.equal(recovered?.reserved_minor, 300); assert.equal(await queue.claim(record.id), null);
  await assert.rejects(queue.complete(record.id, claimed.lease_token!, await accepted(record)), /posse/);
  await assert.rejects(queue.enqueue(await intent(p.id, 10)), /Custo incerto/);
});
test('Resultado forjado não pertence à produção; terminal sem cobrança mantém reserva', async () => {
  const p = await source(), record = await queue.enqueue(await intent(p.id, 300));
  const claimed = (await queue.claim(record.id))!, job = await accepted(record);
  await assert.rejects(queue.complete(record.id, claimed.lease_token!, { ...job, production: { id: 'outra', version: 1 } }), /não pertence/);
  const unknown = await queue.complete(record.id, claimed.lease_token!, { ...job, status: 'succeeded', costs: { ...job.costs, confirmed_minor: null } });
  assert.equal(unknown.state, 'unknown'); assert.equal(unknown.reserved_minor, 300);
  const retry = (await queue.claim(record.id))!;
  const settled = await queue.complete(record.id, retry.lease_token!, { ...job, version: 2, status: 'succeeded', costs: { ...job.costs, confirmed_minor: 200 } });
  assert.equal(settled.state, 'succeeded'); assert.equal(settled.reserved_minor, 0);
  assert.equal((await productions.detail(p.id)).production.costs.confirmed_minor, 200);
});
test('Pausa impede novo envio; cancelamento local libera reserva, mas não simula cancelamento externo', async () => {
  const p = await source(), record = await queue.enqueue(await intent(p.id));
  const current = (await productions.detail(p.id)).production;
  await productions.command({ command_id: randomUUID(), production: { id: p.id, version: current.version }, action: 'pause' });
  assert.equal(await queue.claim(record.id), null);
  await assert.rejects(queue.enqueue(await intent(p.id)), /novos jobs/);
  assert.equal((await queue.cancelPrepared(record.id)).reserved_minor, 0);
  const resumed = (await productions.detail(p.id)).production;
  await productions.command({ command_id: randomUUID(), production: { id: p.id, version: resumed.version }, action: 'resume' });
  const next = await queue.enqueue(await intent(p.id, 100, record.intent.request.execution_key, 2));
  await queue.claim(next.id); await assert.rejects(queue.cancelPrepared(next.id), /reconciliação/);
  await assert.rejects(queue.enqueue(await intent(p.id, 100, sha256(randomUUID()), 3)), /tentativas/);
});
test('Estimativa ausente, moeda divergente e adapter real são bloqueados antes do gasto', async () => {
  const p = await source(), data = await intent(p.id);
  await assert.rejects(queue.enqueue({ ...data, estimate: null }));
  await assert.rejects(queue.enqueue({ ...data, request: { ...data.request, currency: 'USD' } }), /mesma moeda/);
  await assert.rejects(queue.enqueue({ ...data, adapter_id: 'higgsfield_real' }), /liberação server-side/);
  assert.equal((await queue.list(p.id)).length, 0);
});
test('pg-boss nativo deduplica transporte e consulta sem reenviar a intenção', async t => {
  if (!process.env.TEST_DATABASE_URL) { t.skip('Requer PostgreSQL nativo em TEST_DATABASE_URL.'); return; }
  const p = await source(), record = await queue.enqueue(await intent(p.id));
  class CountingAdapter extends SimulatedGenerationAdapter { calls = 0; override async submit(request: GenerationIntent['request']) { this.calls++; return super.submit(request); } }
  const adapter = new CountingAdapter('audio'), errors: string[] = [];
  const transport = new GenerationTransport(process.env.TEST_DATABASE_URL, db, queue, new Map([['sim_audio', adapter]]), 'fbr_generation_test', () => errors.push('transport_error'));
  try {
    await transport.start(false);
    assert.equal(await transport.dispatchPending(p.id), 1); assert.equal(await transport.dispatchPending(p.id), 0);
    for (let step = 0; step < 3; step++) {
      if (step > 0) assert.equal(await transport.dispatchPending(p.id), 1);
      const jobs = await transport.boss.fetch<{ execution_id: string }>('fbr-generation');
      const job = jobs.find(job => job.data.execution_id === record.id); assert.ok(job);
      await transport.process(job.data); await transport.boss.complete('fbr-generation', job.id);
    }
    assert.equal((await queue.get(record.id))!.state, 'succeeded'); assert.equal(adapter.calls, 1);
    assert.equal(await transport.dispatchPending(p.id), 0); assert.deepEqual(errors, []);
  } finally { await transport.stop(); }
});
test('Cancelamento consulta antes, cancela queued e conserva job em andamento', async () => {
  const p = await source(), record = await queue.enqueue(await intent(p.id));
  class QueuedAdapter extends SimulatedGenerationAdapter {
    queuedResponse: AdapterResult | null = null; cancellations = 0;
    override async submit(request: GenerationIntent['request']) { this.queuedResponse = await super.submit(request); return this.queuedResponse; }
    override async query() { return this.queuedResponse!; }
    override async cancel(id: string) { this.cancellations++; return super.cancel(id); }
  }
  const adapter = new QueuedAdapter('audio'), worker = new GenerationWorker(queue, new Map([['sim_audio', adapter]]));
  await worker.run(record.id);
  assert.equal((await worker.cancel(record.id)).state, 'cancelled'); assert.equal(adapter.cancellations, 1);
  assert.equal((await queue.get(record.id))!.reserved_minor, 0);
  const next = await queue.enqueue(await intent(p.id));
  class RunningAdapter extends SimulatedGenerationAdapter { cancellations = 0; override async cancel(id: string) { this.cancellations++; return super.cancel(id); } }
  const running = new RunningAdapter('audio'), runningWorker = new GenerationWorker(queue, new Map([['sim_audio', running]]));
  await runningWorker.run(next.id);
  const result = await runningWorker.cancel(next.id);
  assert.equal(result.state, 'active'); assert.equal(result.provider_job?.status, 'running');
  assert.equal(running.cancellations, 0); assert.equal(result.reserved_minor, 100);
});
test('Acompanhamento HTTP expõe custos/estado sem parâmetros internos ou posse do worker', async () => {
  const p = await source(), record = await queue.enqueue(await intent(p.id, 300));
  const claimed = (await queue.claim(record.id))!;
  await queue.uncertain(record.id, claimed.lease_token!, 'internal_secret_example');
  const app = buildApp(new ConfigurationService(new PostgresConfigurationStore(db)), { productions, generation: queue });
  try {
    const response = await app.inject({ method: 'GET', url: `/api/productions/${p.id}/jobs`, headers: { host: 'localhost' } });
    assert.equal(response.statusCode, 200);
    const summary = GenerationListSchema.parse(response.json()).items[0]!;
    assert.equal(summary.state, 'unknown'); assert.equal(summary.costs.committed_minor, 300); assert.equal(summary.simulated, true);
    assert.equal(summary.production.id, p.id);
    for (const field of ['parameters', 'execution_key', 'lease_token', 'internal_secret_example', 'voice_reference']) assert.equal(response.body.includes(field), false);
    const other = await source();
    assert.deepEqual((await app.inject({ method: 'GET', url: `/api/productions/${other.id}/jobs`, headers: { host: 'localhost' } })).json(), { items: [] });
    assert.equal((await app.inject({ method: 'GET', url: '/api/productions/missing/jobs', headers: { host: 'localhost' } })).statusCode, 404);
  } finally { await app.close(); }
});
test('Cancelar produção via HTTP libera trabalhos não enviados e replay conserva a revisão', async () => {
  const p = await source(), record = await queue.enqueue(await intent(p.id, 300));
  const current = (await productions.detail(p.id)).production;
  const app = buildApp(new ConfigurationService(new PostgresConfigurationStore(db)), { productions, generation: queue });
  try {
    const payload = { command_id: randomUUID(), production: { id: p.id, version: current.version }, action: 'cancel' };
    const response = await app.inject({ method: 'POST', url: `/api/productions/${p.id}/commands`, headers: { host: 'localhost' }, payload });
    assert.equal(response.statusCode, 200); assert.equal(response.json().costs.committed_minor, 0);
    assert.equal((await queue.get(record.id))!.state, 'cancelled');
    const version = (await queue.get(record.id))!.version;
    assert.equal((await app.inject({ method: 'POST', url: `/api/productions/${p.id}/commands`, headers: { host: 'localhost' }, payload })).statusCode, 200);
    assert.equal((await queue.get(record.id))!.version, version);
    assert.equal((await queue.cancelPrepared(record.id)).version, version);
  } finally { await app.close(); }
});
test('Manifestos de mídia são atômicos, imutáveis, isolados por produção e exigem arquivos íntegros', async () => {
  const p = await source(), root = await mkdtemp(join(tmpdir(), 'fbr-media-test-'));
  try {
    const files = new LocalImmutableAssetStore(root), media = new PostgresMediaStore(db, files);
    const bytes = new TextEncoder().encode('Bytes de manifesto sintético; não são mídia aprovada real.'), hash = sha256(new TextDecoder().decode(bytes));
    await files.putImmutable('test/fixture.bin', bytes, hash);
    const image = { ...structuredClone(imageFixture), id: randomUUID(), evaluation_refs: [{ id: randomUUID(), version: 1 }],
      file: { ...imageFixture.file, storage_key: 'test/fixture.bin', bytes: bytes.length, hash } };
    const audio = { ...structuredClone(audioFixture), id: randomUUID(), evaluation_refs: [{ id: randomUUID(), version: 1 }],
      file: { ...audioFixture.file, storage_key: 'test/fixture.bin', bytes: bytes.length, hash } };
    const imageEvaluation = { ...structuredClone(imageEvaluationFixture), id: image.evaluation_refs[0]!.id, target: { id: image.id, version: 1 } };
    const audioEvaluation = { ...structuredClone(audioEvaluationFixture), id: audio.evaluation_refs[0]!.id, target: { id: audio.id, version: 1 } };
    const timeline = { ...structuredClone(timelineFixture), id: randomUUID(), production: { id: p.id, version: 1 },
      audio: timelineFixture.audio.map(segment => ({ ...segment, asset: { id: audio.id, version: 1 } })),
      video: timelineFixture.video.map(segment => ({ ...segment, asset: { id: image.id, version: 1 } })) };
    await media.commit(p.id, [
      { kind: 'asset', record: image, expected_version: null }, { kind: 'asset', record: audio, expected_version: null },
      { kind: 'evaluation', record: imageEvaluation, expected_version: null }, { kind: 'evaluation', record: audioEvaluation, expected_version: null },
      { kind: 'timeline', record: timeline, expected_version: null },
    ]);
    assert.deepEqual(await media.get('asset', { id: image.id, version: 1 }, p.id), image);
    const next = { ...image, version: 2, status: 'outdated' };
    const concurrent = await Promise.allSettled([media.commit(p.id, [{ kind: 'asset', record: next, expected_version: 1 }]), media.commit(p.id, [{ kind: 'asset', record: next, expected_version: 1 }])]);
    assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal((await media.get('asset', { id: image.id, version: 1 }, p.id))!.status, 'approved');
    const invalidTimeline = { ...timeline, id: randomUUID(), video: timeline.video.map(segment => ({ ...segment, asset: { id: image.id, version: 2 } })) };
    await assert.rejects(media.commit(p.id, [{ kind: 'timeline', record: invalidTimeline, expected_version: null }]), /arquivo ausente, inválido/);
    assert.equal(await media.get('timeline', { id: invalidTimeline.id, version: 1 }, p.id), null);
    await assert.rejects(media.commit(p.id, [{ kind: 'timeline', record: { ...timeline, id: randomUUID() }, expected_version: null }]), /revisão de asset substituída/);
    const other = await source(); assert.equal(await media.get('asset', { id: image.id, version: 1 }, other.id), null);
    await assert.rejects(media.commit(other.id, [{ kind: 'asset', record: { ...image, version: 3 }, expected_version: 2 }]), /outra produção/);
    await assert.rejects(media.commit(p.id, [{ kind: 'asset', record: { ...image, id: randomUUID(), file: { ...image.file, storage_key: 'missing.bin' } }, expected_version: null }]), /Arquivo ausente/);
    await assert.rejects(db.query('UPDATE media_revisions SET record=record WHERE id=$1', [image.id]), /Immutable/);
  } finally { assert.ok(root.startsWith(join(tmpdir(), 'fbr-media-test-'))); await rm(root, { recursive: true, force: true }); }
});
test('Backup restaura snapshots e intenções sem sobrescrever destino; adulteração é recusada', async () => {
  const p = await source(), record = await queue.enqueue(await intent(p.id, 200));
  const backup = await captureMetadataBackup(db);
  assert.equal(backup.includes_asset_bytes, false);
  const engine = new PGlite();
  const wrap = (client: Pick<PGlite, 'query' | 'exec'>): SqlClient => ({ async query(sql, values) {
    if (values === undefined) { const result = (await client.exec(sql)).at(-1); return { rows: result?.rows as Record<string, unknown>[] ?? [], rowCount: result?.affectedRows ?? 0 }; }
    const result = await client.query<Record<string, unknown>>(sql, values); return { rows: result.rows, rowCount: result.affectedRows ?? 0 };
  } });
  const target: SqlDatabase = { ...wrap(engine), transaction: run => engine.transaction(tx => run(wrap(tx))) };
  try {
    await migrateConfiguration(target);
    const tampered = { ...backup, created_at: '2000-01-01T00:00:00Z' };
    await assert.rejects(restoreMetadataBackup(target, tampered), /hash_mismatch/);
    assert.ok(await restoreMetadataBackup(target, backup) > 0);
    const restored = new ProductionService(new PostgresProductionStore(target), getPipelineCatalog());
    assert.deepEqual(await restored.detail(p.id), await productions.detail(p.id));
    assert.deepEqual(await new PostgresGenerationQueue(target).get(record.id), record);
    await assert.rejects(restoreMetadataBackup(target, backup), /requires_empty/);
    assert.deepEqual(await restored.detail(p.id), await productions.detail(p.id));
  } finally { await engine.close(); }
});
