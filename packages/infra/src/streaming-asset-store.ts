import type { Readable } from 'node:stream';
import type { AssetStore, Asset } from '@fbr/contracts';
import type { MediaByteRange } from './media-range.js';
/** Optional storage extension. External implementations must preserve immutable hash/byte evidence. */
export interface StreamingAssetStore extends AssetStore {
  openVerified(asset: Asset, range?: MediaByteRange | null): Promise<{ stream: Readable; bytes: number; range: MediaByteRange | null }>;
  putImmutableStream(key: string, source: AsyncIterable<Uint8Array>, expectedHash: string, expectedBytes: number, maxBytes?: number): Promise<void>;
}
export function supportsAssetStreaming(store: AssetStore): store is StreamingAssetStore {
  return 'openVerified' in store && typeof store.openVerified === 'function'
    && 'putImmutableStream' in store && typeof store.putImmutableStream === 'function';
}
