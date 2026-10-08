import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { ProductionSchema, ProductionSnapshotSchema, DossierSchema } from '@fbr/contracts';
import { dossierFixture, productionFixture, articleFixture, profileFixture, universeConfigurationFixture } from '@fbr/contracts/fixtures';
import { canonical, sha256 } from '@fbr/domain';
import { getPipelineCatalog } from '@fbr/pipeline';
import { LocalAssemblyService, assemblyQualityFingerprint } from '../src/assembly-service.js';
import { migrateConfiguration, type SqlClient, type SqlDatabase } from '../src/configuration-store.js';
test('Alinhamento requerido ausente registra diagnóstico/evidência específica e fingerprint sem aceitar qualidade', async () => {
  const engine = new PGlite();
  const wrap = (client: Pick<PGlite, 'query' | 'exec'>): SqlClient => ({ async query(sql, values) {
    if (values === undefined) { const r = (await client.exec(sql)).at(-1); return { rows: r?.rows as Record<string, unknown>[] ?? [], rowCount: r?.affectedRows ?? 0 }; }
    const r = await client.query<Record<string, unknown>>(sql, values); return { rows: r.rows, rowCount: r.affectedRows ?? 0 };
  } });
  const db: SqlDatabase = { ...wrap(engine), transaction: run => engine.transaction(tx => run(wrap(tx))) };
  try {
    await migrateConfiguration(db); const id = randomUUID(), bible = '# Bible sintética de teste.';
    const d = DossierSchema.parse({ ...dossierFixture, id: randomUUID(), production: { id, version: 1 }, assets: dossierFixture.assets.filter(asset => asset.type !== 'render'),
      jobs: [], timeline: null, approvals: [], pending_issues: [] });
    const p = ProductionSchema.parse({ ...productionFixture, id, status: 'producing', stage: 'assembly', dossier: { id: d.id, version: 1 },
      current_render: null, current_approval: null, pending_issues: [] });
    const article = { ...articleFixture, content_hash: sha256(articleFixture.content) }, profile = profileFixture,
      character = { ...universeConfigurationFixture.characters[0]!, id: profile.character.id,
        bible: { ...universeConfigurationFixture.characters[0]!.bible, original_hash: sha256(bible) } };
    const source = { production_id: id, captured_at: '2026-10-07T00:00:00Z', request: { contract_version: '0.1.0', command_id: randomUUID(), name: 'Ensaio quality gate', mode: 'calibration',
      article: d.article, profile: d.profile }, article, profile, character, bible_original: bible, references: [], catalog: getPipelineCatalog() };
    const snapshot = ProductionSnapshotSchema.parse({ ...source, hash: sha256(canonical(source)) });
    await db.query('INSERT INTO production_heads(id,version) VALUES($1,1)', [id]);
    await db.query('INSERT INTO production_revisions(id,version,record) VALUES($1,1,$2::jsonb)', [id, JSON.stringify(p)]);
    await db.query('INSERT INTO production_snapshots(production_id,record) VALUES($1,$2::jsonb)', [id, JSON.stringify(snapshot)]);
    await db.query('INSERT INTO production_dossiers(id,version,record) VALUES($1,1,$2::jsonb)', [d.id, JSON.stringify(d)]);
    for (const asset of d.assets) {
      await db.query("INSERT INTO media_heads(kind,id,production_id,version) VALUES('asset',$1,$2,1)", [asset.id, id]);
      await db.query("INSERT INTO media_revisions(kind,id,version,record) VALUES('asset',$1,1,$2::jsonb)", [asset.id, JSON.stringify(asset)]);
    }
    const quality = { require_word_timings: true }, service = new LocalAssemblyService(db, {
      async read() { throw new Error('No rendering or read expected for missing alignment.'); },
      async putImmutable() { throw new Error('No media write expected.'); }, exists: async () => true,
    }, undefined, quality), command = { command_id: randomUUID(), production: { id, version: 1 }, bindings: {
      audio: [{ speech_segment_id: 'speech_01', asset: { id: d.assets.find(asset => asset.type === 'audio')!.id, version: 1 } }],
      video: [{ shot: { id: d.shots[0]!.id, version: 1 }, asset: { id: d.assets.find(asset => asset.type === 'image')!.id, version: 1 } }],
    } };
    await assert.rejects(service.assemble(command), /alinhamento observado/u);
    const run = (await db.query('SELECT state,diagnostic FROM assembly_runs WHERE command_id=$1', [command.command_id])).rows[0]!;
    assert.equal(run.state, 'failed'); assert.equal(run.diagnostic, 'assembly_quality_subtitle_alignment_failed');
    const evidence = (await db.query('SELECT record FROM assembly_evidence WHERE command_id=$1', [command.command_id])).rows[0]!.record as Record<string, unknown>;
    assert.equal(evidence.quality_hash, assemblyQualityFingerprint(quality)); assert.equal(evidence.production_version, 1);
    assert.deepEqual(evidence.dossier, { id: d.id, version: d.version });
    assert.equal(evidence.status, 'failed'); assert.equal(evidence.render_hash, null);
    await assert.rejects(service.assemble(command), /já iniciada/u);
    assert.equal((await db.query('SELECT count(*) AS n FROM assembly_evidence')).rows[0]!.n, 1);
    assert.notEqual(assemblyQualityFingerprint(quality), assemblyQualityFingerprint({ require_word_timings: false }));
  } finally { await engine.close(); }
});
