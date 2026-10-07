import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PGlite } from '@electric-sql/pglite';
import type { Asset, AssetStore } from '@fbr/contracts';
import { imageFixture, productionFixture } from '@fbr/contracts/fixtures';
import { sha256 } from '@fbr/domain';
import { LocalImmutableAssetStore } from '../src/asset-store.js';
import { captureFullBackup, restoreFullBackup } from '../src/full-backup.js';
import { migrateConfiguration, type SqlClient, type SqlDatabase } from '../src/configuration-store.js';
function database() {
  const engine = new PGlite(), wrap = (client: Pick<PGlite, 'query' | 'exec'>): SqlClient => ({ async query(sql, values) {
    if (values === undefined) { const result = (await client.exec(sql)).at(-1); return { rows: result?.rows as Record<string, unknown>[] ?? [], rowCount: result?.affectedRows ?? 0 }; }
    const result = await client.query<Record<string, unknown>>(sql, values); return { rows: result.rows, rowCount: result.affectedRows ?? 0 };
  } });
  const db: SqlDatabase = { ...wrap(engine), transaction: run => engine.transaction(tx => run(wrap(tx))) }; return { db, engine };
}
class StreamingOnlyStore extends LocalImmutableAssetStore {
  streamedReads = 0; streamedWrites = 0;
  override read(key: string) { if (key.startsWith('media/')) throw new Error('test_media_buffered_read_forbidden'); return super.read(key); }
  override putImmutable(key: string, bytes: Uint8Array, hash: string) { if (key.startsWith('media/')) throw new Error('test_media_buffered_write_forbidden'); return super.putImmutable(key, bytes, hash); }
  override async openVerified(asset: Asset) { this.streamedReads++; return super.openVerified(asset); }
  override async putImmutableStream(key: string, source: AsyncIterable<Uint8Array>, hash: string, bytes: number, maxBytes?: number) {
    this.streamedWrites++; return super.putImmutableStream(key, source, hash, bytes, maxBytes);
  }
}
test('Backup/restore de mídia >100MB usa streams verificados, conserva sintéticos e recusa fallback grande', async () => {
  const source = database(), target = database(), root = await mkdtemp(join(tmpdir(), 'fbr-backup-stream-test-'));
  try {
    await migrateConfiguration(source.db); await migrateConfiguration(target.db);
    const liveRoot = join(root, 'live'), archiveRoot = join(root, 'archive'), restoredRoot = join(root, 'restored');
    const live = new StreamingOnlyStore(liveRoot), archive = new StreamingOnlyStore(archiveRoot), restored = new StreamingOnlyStore(restoredRoot);
    const chunk = Buffer.alloc(1024 * 1024, 37), repetitions = 101, bytes = chunk.length * repetitions;
    const digest = createHash('sha256'); for (let i = 0; i < repetitions; i++) digest.update(chunk);
    const hash = digest.digest('hex'), key = `media/${hash}.bin`;
    async function* chunks() { for (let i = 0; i < repetitions; i++) yield chunk; }
    await new LocalImmutableAssetStore(liveRoot).putImmutableStream(key, chunks(), hash, bytes);
    const asset = { ...imageFixture, file: { ...imageFixture.file, storage_key: key, hash, bytes } }, production = productionFixture;
    await source.db.query('INSERT INTO production_heads(id,version) VALUES($1,1)', [production.id]);
    await source.db.query('INSERT INTO production_revisions(id,version,record) VALUES($1,1,$2::jsonb)', [production.id, JSON.stringify(production)]);
    await source.db.query("INSERT INTO media_heads(kind,id,production_id,version) VALUES('asset',$1,$2,1)", [asset.id, production.id]);
    await source.db.query("INSERT INTO media_revisions(kind,id,version,record) VALUES('asset',$1,1,$2::jsonb)", [asset.id, JSON.stringify(asset)]);
    const synthetic = Buffer.from('Synthetic output referenced before media ingestion.'), syntheticHash = sha256(synthetic.toString()), syntheticKey = `synthetic/${syntheticHash}.bin`;
    await live.putImmutable(syntheticKey, synthetic, syntheticHash);
    await source.db.query('INSERT INTO synthetic_generation_results(external_id,production_id,fingerprint,record) VALUES($1,$2,$3,$4::jsonb)',
      ['synthetic_before_ingest', production.id, sha256('synthetic'), JSON.stringify({ outputs: [{ id: 'synthetic_output', storage_key: syntheticKey, hash: syntheticHash, bytes: synthetic.length }] })]);
    const noStreaming: AssetStore = { read: () => { throw new Error('buffered_read_must_not_run'); }, putImmutable: () => { throw new Error('buffered_write_must_not_run'); }, exists: async () => true };
    await assert.rejects(captureFullBackup(source.db, noStreaming, archive), /backup_buffer_limit_exceeded/);
    const backup = await captureFullBackup(source.db, live, archive);
    assert.equal(backup.files, 2); assert.equal(backup.bytes, bytes + synthetic.length);
    assert.equal(live.streamedReads, 1); assert.equal(archive.streamedWrites, 1);
    const result = await restoreFullBackup(target.db, archive, restored, backup.metadata_key, backup.metadata_hash);
    assert.equal(result.files, 2); assert.equal(archive.streamedReads, 1); assert.equal(restored.streamedWrites, 1);
    assert.equal(await new LocalImmutableAssetStore(restoredRoot).exists(asset), true);
    assert.deepEqual(await restored.read(syntheticKey), synthetic);
    assert.equal((await target.db.query('SELECT count(*) AS n FROM synthetic_generation_results')).rows[0]!.n, 1);
  } finally {
    await source.engine.close(); await target.engine.close(); assert.ok(root.startsWith(join(tmpdir(), 'fbr-backup-stream-test-'))); await rm(root, { recursive: true, force: true });
  }
});
