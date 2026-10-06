import {createHash} from 'node:crypto';
import {AssetSchema,type AssetStore} from '@fbr/contracts';
import {canonical,sha256} from '@fbr/domain';
import {captureMetadataBackup,restoreMetadataBackup,MetadataBackupSchema,type MetadataBackup} from './metadata-backup.js';
import type {SqlDatabase} from './configuration-store.js';
function referencedFiles(backup:MetadataBackup){
  const records=new Map<string,{storage_key:string;hash:string;bytes:number|null}>();
  for(const row of backup.tables.media_revisions??[]){if(row.kind!=='asset')continue;
    const asset=AssetSchema.parse(row.record),old=records.get(asset.file.storage_key);
    if(old&&(old.hash!==asset.file.hash||old.bytes!==asset.file.bytes))throw new Error('backup_storage_conflict');
    records.set(asset.file.storage_key,asset.file);
  }
  for(const row of 'delivery_manifests' in backup.tables?backup.tables.delivery_manifests:[]){
    if(typeof row.storage_key!=='string'||typeof row.hash!=='string')throw new Error('backup_manifest_invalid');
    records.set(row.storage_key,{storage_key:row.storage_key,hash:row.hash,bytes:null});
  }
  return [...records.values()];
}
async function copyVerified(backup:MetadataBackup,source:AssetStore,target:AssetStore){
  let bytes=0;const records=referencedFiles(backup);
  for(const file of records){const data=await source.read(file.storage_key);
    if((file.bytes!==null&&data.length!==file.bytes)||createHash('sha256').update(data).digest('hex')!==file.hash)throw new Error('backup_media_missing_or_corrupt');
    await target.putImmutable(file.storage_key,data,file.hash);bytes+=data.length;
  }
  return {files:records.length,bytes};
}
/** Metadados aparecem no destino somente depois da cópia verificada de todas as revisões de mídia. */
export async function captureFullBackup(db:SqlDatabase,source:AssetStore,target:AssetStore){
  const backup=await captureMetadataBackup(db),copied=await copyVerified(backup,source,target);
  const bytes=new TextEncoder().encode(canonical(backup)),hash=sha256(canonical(backup)),metadata_key=`metadata/${hash}.json`;
  await target.putImmutable(metadata_key,bytes,hash);
  return {metadata_key,metadata_hash:hash,...copied};
}
export async function restoreFullBackup(db:SqlDatabase,source:AssetStore,target:AssetStore,metadataKey:string,metadataHash:string){
  const bytes=await source.read(metadataKey);
  if(createHash('sha256').update(bytes).digest('hex')!==metadataHash)throw new Error('backup_metadata_corrupt');
  const backup=MetadataBackupSchema.parse(JSON.parse(new TextDecoder().decode(bytes))),{hash,...body}=backup;
  if(hash!==sha256(canonical(body)))throw new Error('metadata_backup_hash_mismatch');
  const copied=await copyVerified(backup,source,target);
  const restored=await restoreMetadataBackup(db,backup);return {...copied,rows:restored};
}
