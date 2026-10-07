import {createHash} from 'node:crypto';
import {AssetSchema,type AssetStore,type Asset} from '@fbr/contracts';
import {canonical,sha256} from '@fbr/domain';
import {captureMetadataBackup,restoreMetadataBackup,MetadataBackupSchema,type MetadataBackup} from './metadata-backup.js';
import type {SqlDatabase} from './configuration-store.js';
import { supportsAssetStreaming } from './streaming-asset-store.js';
const BUFFERED_BACKUP_LIMIT = 100_000_000;
function referencedFiles(backup:MetadataBackup){
  const records=new Map<string,{storage_key:string;hash:string;bytes:number|null;asset:Asset|null}>();
  for(const row of backup.tables.media_revisions??[]){if(row.kind!=='asset')continue;
    const asset=AssetSchema.parse(row.record),old=records.get(asset.file.storage_key);
    if(old&&(old.hash!==asset.file.hash||old.bytes!==asset.file.bytes))throw new Error('backup_storage_conflict');
    records.set(asset.file.storage_key,{...asset.file,asset});
  }
  for(const row of 'delivery_manifests' in backup.tables?backup.tables.delivery_manifests:[]){
    if(typeof row.storage_key!=='string'||typeof row.hash!=='string')throw new Error('backup_manifest_invalid');
    const old=records.get(row.storage_key);if(old&&old.hash!==row.hash)throw new Error('backup_storage_conflict');
    if(!old)records.set(row.storage_key,{storage_key:row.storage_key,hash:row.hash,bytes:null,asset:null});
  }
  for(const row of 'synthetic_generation_results' in backup.tables?backup.tables.synthetic_generation_results:[]){
    const result=row.record as {outputs?:{storage_key:string;hash:string;bytes:number}[]};
    for(const output of result.outputs??[]){const old=records.get(output.storage_key);if(old&&(old.hash!==output.hash||old.bytes!==null&&old.bytes!==output.bytes))throw new Error('backup_storage_conflict');
      if(!old)records.set(output.storage_key,{...output,asset:null});}
  }
  return [...records.values()];
}
async function copyVerified(backup:MetadataBackup,source:AssetStore,target:AssetStore){
  let bytes=0;const records=referencedFiles(backup);
  for(const file of records){
    if(file.asset&&supportsAssetStreaming(source)&&supportsAssetStreaming(target)){
      const opened=await source.openVerified(file.asset);
      try{
        if(opened.range!==null||opened.bytes!==file.bytes)throw new Error('backup_media_missing_or_corrupt');
        await target.putImmutableStream(file.storage_key,opened.stream,file.hash,opened.bytes);
        bytes+=opened.bytes;
      }finally{opened.stream.destroy();}
      continue;
    }
    if(file.bytes!==null&&file.bytes>BUFFERED_BACKUP_LIMIT)throw new Error('backup_buffer_limit_exceeded');
    const data=await source.read(file.storage_key);
    if(data.length>BUFFERED_BACKUP_LIMIT)throw new Error('backup_buffer_limit_exceeded');
    if((file.bytes!==null&&data.length!==file.bytes)||createHash('sha256').update(data).digest('hex')!==file.hash)throw new Error('backup_media_missing_or_corrupt');
    await target.putImmutable(file.storage_key,data,file.hash);bytes+=data.length;
  }
  return {files:records.length,bytes};
}
/** Metadados aparecem no destino somente depois da cópia verificada de todas as revisões de mídia. */
export async function captureFullBackup(db:SqlDatabase,source:AssetStore,target:AssetStore){
  const backup=await captureMetadataBackup(db),copied=await copyVerified(backup,source,target);
  const serialized=canonical(backup),bytes=new TextEncoder().encode(serialized),hash=sha256(serialized),metadata_key=`metadata/${hash}.json`;
  if(bytes.length>BUFFERED_BACKUP_LIMIT)throw new Error('backup_buffer_limit_exceeded');
  await target.putImmutable(metadata_key,bytes,hash);
  return {metadata_key,metadata_hash:hash,...copied};
}
export async function restoreFullBackup(db:SqlDatabase,source:AssetStore,target:AssetStore,metadataKey:string,metadataHash:string){
  const bytes=await source.read(metadataKey);
  if(bytes.length>BUFFERED_BACKUP_LIMIT)throw new Error('backup_buffer_limit_exceeded');
  if(createHash('sha256').update(bytes).digest('hex')!==metadataHash)throw new Error('backup_metadata_corrupt');
  const backup=MetadataBackupSchema.parse(JSON.parse(new TextDecoder().decode(bytes))),{hash,...body}=backup;
  if(hash!==sha256(canonical(body)))throw new Error('metadata_backup_hash_mismatch');
  const copied=await copyVerified(backup,source,target);
  const restored=await restoreMetadataBackup(db,backup);return {...copied,rows:restored};
}
