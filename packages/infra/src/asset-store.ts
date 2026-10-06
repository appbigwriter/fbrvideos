import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, link, unlink, realpath } from 'node:fs/promises';
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
    try { const bytes = await this.read(asset.file.storage_key); return bytes.byteLength === asset.file.bytes && hash(bytes) === asset.file.hash; }
    catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
      throw error;
    }
  }
}
