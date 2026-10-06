import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { imageFixture, dossierFixture, productionFixture } from '@fbr/contracts/fixtures';
import { buildDeliveryManifest } from '@fbr/domain';
import { LocalImmutableAssetStore } from '../src/asset-store.js';
import { storeDeliveryManifest } from '../src/delivery-store.js';

test('AssetStore conserva bytes/hash, replay concorrente e recusa sobrescrita ou caminho externo', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fbr-assets-test-'));
  try {
    const store = new LocalImmutableAssetStore(root), bytes = new TextEncoder().encode('Mídia sintética para integridade.');
    const hash = createHash('sha256').update(bytes).digest('hex'), key = `assets/${hash}.bin`;
    await Promise.all([store.putImmutable(key, bytes, hash), store.putImmutable(key, bytes, hash)]);
    assert.deepEqual(Buffer.from(await new LocalImmutableAssetStore(root).read(key)), Buffer.from(bytes));
    const asset = { ...imageFixture, file: { ...imageFixture.file, storage_key: key, hash, bytes: bytes.byteLength } };
    assert.equal(await store.exists(asset), true);
    assert.equal(await store.exists({ ...asset, file: { ...asset.file, storage_key: 'missing.bin' } }), false);
    const other = new TextEncoder().encode('Outro conteúdo');
    await assert.rejects(store.putImmutable(key, other, createHash('sha256').update(other).digest('hex')), /immutable_conflict/);
    await assert.rejects(store.putImmutable('bad.bin', bytes, 'a'.repeat(64)), /hash_mismatch/);
    for (const path of ['../outside.bin', '/absolute.bin', 'C:/outside.bin', 'assets/CON.txt', 'assets/a:stream', 'assets/a\\outside', 'assets/..'])
      await assert.rejects(store.putImmutable(path, bytes, hash), /storage_key_invalid/);
    assert.deepEqual(await readdir(join(root, 'assets')), [`${hash}.bin`]);
    const dossier = structuredClone(dossierFixture);
    const render = dossier.assets.find(asset => asset.type === 'render')!;
    render.file = { ...render.file, storage_key: key, bytes: bytes.length, hash };
    const manifest = buildDeliveryManifest(productionFixture, dossier, 'preview');
    const exported = await storeDeliveryManifest(store, manifest);
    assert.deepEqual(await storeDeliveryManifest(store, manifest), exported);
    assert.equal(JSON.parse(new TextDecoder().decode(await store.read(exported.storage_key))).status, 'preview');
    await writeFile(join(root, 'assets', `${hash}.bin`), other);
    assert.equal(await store.exists(asset), false);
    await assert.rejects(storeDeliveryManifest(store, manifest), /missing_or_corrupt/);
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'fbr-assets-test-')));
    await rm(root, { recursive: true, force: true });
  }
});
