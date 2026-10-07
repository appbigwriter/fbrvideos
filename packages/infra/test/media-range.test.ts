import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { dossierFixture } from '@fbr/contracts/fixtures';
import { LocalImmutableAssetStore } from '../src/asset-store.js';
import { parseMediaRange } from '../src/media-range.js';
test('Ranges abertos/suffix/clamped são determinísticos; inválidos não são aceitos', () => {
  assert.deepEqual(parseMediaRange('bytes=2-', 10), { start: 2, end: 9 });
  assert.deepEqual(parseMediaRange('bytes=-3', 10), { start: 7, end: 9 });
  assert.deepEqual(parseMediaRange('bytes=0-99', 10), { start: 0, end: 9 });
  for (const value of ['bytes=10-', 'bytes=4-2', 'bytes=-0', 'bytes=0-1,3-4', 'bytes=-', 'bytes=9007199254740992-'])
    assert.throws(() => parseMediaRange(value, 10), /unsatisfiable/);
});
test('Streaming grava sem sobrescrever e verifica arquivo inteiro antes de servir range', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fbr-stream-test-'));
  try {
    const store = new LocalImmutableAssetStore(root), bytes = Buffer.alloc(700000, 42), hash = createHash('sha256').update(bytes).digest('hex');
    async function* chunks() { yield bytes.subarray(0, 200000); yield bytes.subarray(200000); }
    await store.putImmutableStream('inputs/file.bin', chunks(), hash, bytes.length);
    await store.putImmutableStream('inputs/file.bin', chunks(), hash, bytes.length);
    const asset = structuredClone(dossierFixture.assets[0]!); asset.file = { ...asset.file, storage_key: 'inputs/file.bin', hash, bytes: bytes.length };
    const opened = await store.openVerified(asset, { start: 250000, end: 250999 });
    const result: Buffer[] = []; for await (const chunk of opened.stream) result.push(chunk);
    assert.deepEqual(Buffer.concat(result), bytes.subarray(250000, 251000)); assert.equal(opened.bytes, 1000);
    await assert.rejects(store.putImmutableStream('inputs/bad.bin', chunks(), hash, 2), /stream_size/);
    assert.deepEqual((await readdir(join(root, 'inputs'))).sort(), ['file.bin']);
    await writeFile(join(root, 'inputs/file.bin'), Buffer.alloc(bytes.length, 43));
    await assert.rejects(store.openVerified(asset, { start: 0, end: 1 }), /hash_mismatch/);
  } finally { assert.ok(root.startsWith(join(tmpdir(), 'fbr-stream-test-'))); await rm(root, { recursive: true, force: true }); }
});
