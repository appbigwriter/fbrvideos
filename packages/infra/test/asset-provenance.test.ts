import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { AssetSchema, GenerationExecutionSchema, JobSchema, type Asset, type GenerationExecution } from '@fbr/contracts';
import { imageFixture, jobFixture, dossierFixture } from '@fbr/contracts/fixtures';
import { sha256, correctionImpact, invalidateDossier } from '@fbr/domain';
import { belongsToExecution } from '../src/asset-provenance.js';
import { migrateConfiguration, type SqlClient, type SqlDatabase } from '../src/configuration-store.js';
let engine: PGlite, db: SqlDatabase;
before(async () => {
  engine = new PGlite();
  const wrap = (client: Pick<PGlite, 'query' | 'exec'>): SqlClient => ({ async query(sql, values) {
    if (values === undefined) { const result = (await client.exec(sql)).at(-1); return { rows: result?.rows as Record<string, unknown>[] ?? [], rowCount: result?.affectedRows ?? 0 }; }
    const result = await client.query<Record<string, unknown>>(sql, values); return { rows: result.rows, rowCount: result.affectedRows ?? 0 };
  } });
  db = { ...wrap(engine), transaction: run => engine.transaction(tx => run(wrap(tx))) }; await migrateConfiguration(db);
});
after(async () => engine.close());
async function seed() {
  const productionId = randomUUID(), executionId = randomUUID(), assetId = randomUUID(), jobId = randomUUID(), key = sha256(randomUUID()), configuration = sha256(randomUUID());
  const originalJob = JobSchema.parse({ ...jobFixture, id: jobId, version: 1, production: { id: productionId, version: 1 }, execution_key: key,
    configuration_hash: configuration, output_assets: [{ id: assetId, version: 1 }], external_job_id: randomUUID(),
    costs: { currency: 'BRL', estimated_minor: 50, committed_minor: 0, confirmed_minor: null } });
  const initial = GenerationExecutionSchema.parse({ id: executionId, version: 1, state: 'succeeded', reserved_minor: 50, confirmed_minor: 0,
    provider_job: originalJob, diagnostic: null, lease_token: null, lease_until: null,
    intent: { adapter_id: 'sim_image', estimate: { currency: 'BRL', upper_minor: 50, evidence: 'Synthetic quote; no live cost.' },
      request: { contract_version: '0.1.0', execution_key: key, attempt: 1, production: { id: productionId, version: 1 }, shot: imageFixture.specification,
        operation: 'image', route: 'still_image', input_assets: [], references: imageFixture.references, configuration_hash: configuration,
        parameters: { prompt: 'Synthetic lineage test' }, currency: 'BRL', reserved_minor: 50 } } });
  const billingJob = JobSchema.parse({ ...originalJob, version: 2, costs: { ...originalJob.costs, confirmed_minor: 45 },
    changes: [...originalJob.changes, { at: '2026-10-06T12:00:00Z', author: 'synthetic_billing', reason: 'Known invoice arrived after output.' }] });
  const latest = GenerationExecutionSchema.parse({ ...initial, version: 2, reserved_minor: 0, confirmed_minor: 45, provider_job: billingJob });
  const candidate = AssetSchema.parse({ ...imageFixture, id: assetId, version: 1, status: 'candidate', evaluation_refs: [],
    execution: { id: jobId, version: 1 }, configuration_hash: configuration });
  const approved = AssetSchema.parse({ ...candidate, version: 2, status: 'approved', evaluation_refs: [{ id: randomUUID(), version: 1 }],
    changes: [{ at: '2026-10-06T12:00:00Z', author: 'synthetic_operator', reason: 'Synthetic approved metadata descendant.' }] });
  await db.query('INSERT INTO production_heads(id,version) VALUES($1,1)', [productionId]);
  await db.query('INSERT INTO generation_heads(id,production_id,execution_key,attempt,fingerprint,version) VALUES($1,$2,$3,1,$4,2)', [executionId, productionId, key, sha256('lineage')]);
  for (const execution of [initial, latest]) await db.query('INSERT INTO generation_revisions(id,version,record) VALUES($1,$2,$3::jsonb)', [executionId, execution.version, JSON.stringify(execution)]);
  await db.query("INSERT INTO media_heads(kind,id,production_id,version) VALUES('asset',$1,$2,2)", [assetId, productionId]);
  for (const asset of [candidate, approved]) await db.query("INSERT INTO media_revisions(kind,id,version,record) VALUES('asset',$1,$2,$3::jsonb)", [asset.id, asset.version, JSON.stringify(asset)]);
  return { productionId, candidate, approved, initial, latest };
}
test('Candidato v1 e aprovação v2 mantêm proveniência após cobrança job v2', async () => {
  const { productionId, candidate, approved, initial, latest } = await seed();
  assert.equal(await belongsToExecution(db, productionId, candidate, initial), true);
  assert.equal(await belongsToExecution(db, productionId, approved, initial), true);
  assert.equal(await belongsToExecution(db, productionId, approved, latest), true);
  assert.equal(approved.execution!.version, 1); assert.equal(latest.provider_job!.version, 2);
});
test('Mesmos IDs não autorizam bytes/configuração/spec/referências alterados nem outra produção/job', async () => {
  const { productionId, approved, latest } = await seed();
  const variants: Asset[] = [
    { ...approved, file: { ...approved.file, hash: 'f'.repeat(64) } },
    { ...approved, file: { ...approved.file, bytes: approved.file.bytes + 1 } },
    { ...approved, file: { ...approved.file, storage_key: 'different/key.png' } },
    { ...approved, configuration_hash: 'f'.repeat(64) },
    { ...approved, specification: { ...approved.specification, version: approved.specification.version + 1 } },
    { ...approved, references: [] },
    { ...approved, execution: { id: randomUUID(), version: 1 } },
    { ...approved, execution: { id: latest.provider_job!.id, version: 2 } },
  ];
  for (const asset of variants) assert.equal(await belongsToExecution(db, productionId, asset, latest), false);
  assert.equal(await belongsToExecution(db, randomUUID(), approved, latest), false);
  const differentExecution: GenerationExecution = { ...latest, intent: { ...latest.intent,
    request: { ...latest.intent.request, execution_key: sha256('different_request') } } };
  assert.equal(await belongsToExecution(db, productionId, approved, differentExecution), false);
});
test('Origem sem revisão imutável de job não comprova descendência por ID', async () => {
  const { productionId, approved, latest } = await seed();
  const fake: GenerationExecution = { ...latest, id: randomUUID() };
  assert.equal(await belongsToExecution(db, productionId, approved, fake), false);
});
test('Grafo visual preserva shot/áudio; invalidação narrativa mantém proveniência antiga sem ciclo', () => {
  const original = structuredClone(dossierFixture), audio = original.assets.find(asset => asset.type === 'audio')!;
  audio.specification = { id: original.id, version: original.version };
  const image = original.assets.find(asset => asset.type === 'image')!, visual = invalidateDossier(original, [{ id: image.id, version: image.version }]);
  assert.equal(visual.shots[0]!.version, original.shots[0]!.version); assert.equal(visual.assets.find(asset => asset.id === audio.id)!.version, audio.version);
  const narrative = invalidateDossier(original, [{ id: original.id, version: original.version }]);
  assert.equal(narrative.shots[0]!.version, original.shots[0]!.version + 1);
  assert.equal(narrative.assets.find(asset => asset.id === image.id)!.status, 'outdated');
  assert.deepEqual(narrative.assets.find(asset => asset.id === image.id)!.specification, image.specification);
  assert.doesNotThrow(() => correctionImpact(narrative, [{ id: narrative.id, version: narrative.version }]));
});
