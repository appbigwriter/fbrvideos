import { createHash } from 'node:crypto';
import { ExportManifestSchema, type AssetStore } from '@fbr/contracts';
import { canonical } from '@fbr/domain';

export async function storeDeliveryManifest(store: AssetStore, raw: unknown) {
  const manifest = ExportManifestSchema.parse(raw);
  for (const asset of manifest.assets) if (!await store.exists(asset)) throw new Error('delivery_file_missing_or_corrupt');
  const bytes = new TextEncoder().encode(canonical(manifest));
  const hash = createHash('sha256').update(bytes).digest('hex'), storageKey = `exports/${hash}.json`;
  await store.putImmutable(storageKey, bytes, hash);
  return { manifest, storage_key: storageKey, hash, bytes: bytes.length };
}
