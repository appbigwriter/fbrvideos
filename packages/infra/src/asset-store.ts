import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, link, unlink, realpath, open } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import type { MediaByteRange } from './media-range.js';
import { basename, isAbsolute, relative, resolve, sep, join } from 'node:path';
import { HashSchema, type Asset, type AssetStore } from '@fbr/contracts';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function within(root: string, path: string) {
  const fragment = relative(root, path);
  if (isAbsolute(fragment) || fragment === '..' || fragment.startsWith(`..${sep}`)) throw new Error('asset_path_outside_store');
}
/** Escrita atômica sem sobrescrita; integridade é conferida também na leitura. */
export class LocalImmutableAssetStore implements AssetStore {
  private readonly root: string;
  constructor(root: string) { this.root = resolve(root); }
  private path(key: string) {
    const segments = key.split('/');
    if (!segments.length || segments.some(part => !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(part)
      || part.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('asset_storage_key_invalid');
    const path = resolve(this.root, ...segments); within(this.root, path); return path;
  }
  private async rootPath() { await mkdir(this.root, { recursive: true }); return realpath(this.root); }
  async putImmutable(key: string, bytes: Uint8Array, expectedHash: string) {
    HashSchema.parse(expectedHash);
    if (!bytes.byteLength || hash(bytes) !== expectedHash) throw new Error('asset_hash_mismatch');
    const requested = this.path(key), root = await this.rootPath();
    let parent = root;
    for (const segment of key.split('/').slice(0, -1)) {
      const next = join(parent, segment);
      try { await mkdir(next); }
      catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error; }
      parent = await realpath(next); within(root, parent);
    }
    const path = join(parent, basename(requested));
    const temporary = resolve(parent, `.pending-${randomUUID()}`);
    try {
      await writeFile(temporary, bytes, { flag: 'wx' });
      try { await link(temporary, path); }
      catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
        if (hash(await this.read(key)) !== expectedHash) throw new Error('asset_immutable_conflict');
      }
    } finally {
      try { await unlink(temporary); }
      catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    }
  }
  async read(key: string): Promise<Uint8Array> {
    const path = this.path(key), root = await this.rootPath();
    const resolved = await realpath(path); within(root, resolved);
    return readFile(resolved);
  }
  async exists(asset: Asset) {
    try {const opened=await this.openVerified(asset);await new Promise<void>(resolve=>{opened.stream.once('close',resolve);opened.stream.destroy();});return true;}
    catch (error) {
      if (error instanceof Error && (error.message==='asset_hash_mismatch'||'code' in error && error.code === 'ENOENT')) return false;
      throw error;
    }
  }
  /** Verify the complete file in bounded chunks, then stream a range from the same open handle. */
  async openVerified(asset: Asset, range: MediaByteRange | null = null): Promise<{ stream: Readable; bytes: number; range: MediaByteRange | null }> {
    const path = this.path(asset.file.storage_key), root = await this.rootPath(), resolved = await realpath(path); within(root, resolved);
    if (range && (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0 || range.end < range.start || range.end >= asset.file.bytes))
      throw new Error('media_range_unsatisfiable');
    const handle = await open(resolved, 'r');
    try {
      const before = await handle.stat(); if (!before.isFile() || before.size !== asset.file.bytes) throw new Error('asset_hash_mismatch');
      const digest = createHash('sha256'), buffer = Buffer.allocUnsafe(256 * 1024); let position = 0;
      while (position < before.size) { const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, before.size - position), position);
        if (!bytesRead) throw new Error('asset_hash_mismatch'); digest.update(buffer.subarray(0, bytesRead)); position += bytesRead; }
      const after = await handle.stat();
      if (digest.digest('hex') !== asset.file.hash || after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw new Error('asset_hash_mismatch');
      const stream = handle.createReadStream({ start: range?.start ?? 0, end: range?.end ?? before.size - 1, autoClose: true });
      return { stream, bytes: range ? range.end - range.start + 1 : before.size, range };
    } catch (error) { await handle.close(); throw error; }
  }
  async putImmutableStream(key: string, source: AsyncIterable<Uint8Array>, expectedHash: string,
    expectedBytes: number, maxBytes = 2_000_000_000): Promise<void> {
    HashSchema.parse(expectedHash);
    if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 1 || expectedBytes > maxBytes || !Number.isSafeInteger(maxBytes) || maxBytes < 1)
      throw new Error('asset_stream_size_invalid');
    const requested = this.path(key), root = await this.rootPath(); let parent = root;
    for (const segment of key.split('/').slice(0, -1)) {
      const next = join(parent, segment); try { await mkdir(next); }
      catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error; }
      parent = await realpath(next); within(root, parent);
    }
    const destination = join(parent, basename(requested)), temporary = join(parent, `.pending-${randomUUID()}`);
    const handle = await open(temporary, 'wx'), digest = createHash('sha256'); let count = 0;
    try {
      for await (const part of source) {
        if (!(part instanceof Uint8Array)) throw new Error('asset_stream_chunk_invalid');
        count += part.byteLength; if (!Number.isSafeInteger(count) || count > expectedBytes || count > maxBytes) throw new Error('asset_stream_size_invalid');
        digest.update(part); let position = 0;
        while (position < part.byteLength) { const { bytesWritten } = await handle.write(part, position, part.byteLength - position); if (!bytesWritten) throw new Error('asset_stream_write_failed'); position += bytesWritten; }
      }
      if (count !== expectedBytes || digest.digest('hex') !== expectedHash) throw new Error('asset_hash_mismatch');
      await handle.sync(); await handle.close();
      try { await link(temporary, destination); }
      catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
        const existingPath = await realpath(destination); within(root, existingPath);
        const existing = await open(existingPath, 'r');
        try { const hash = createHash('sha256'); let size = 0; for await (const part of existing.createReadStream({ autoClose: false })) { hash.update(part); size += part.length; }
          if (size !== expectedBytes || hash.digest('hex') !== expectedHash) throw new Error('asset_immutable_conflict'); }
        finally { await existing.close(); }
      }
    } finally { await handle.close().catch(() => {}); await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
}
