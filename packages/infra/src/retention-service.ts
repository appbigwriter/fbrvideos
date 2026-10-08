import {readdir,lstat,realpath,open,unlink} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep,join} from 'node:path';
import {createHash} from 'node:crypto';
import {canonical,sha256,planRetention,RetentionPolicySchema} from '@fbr/domain';
import type {SqlDatabase} from './configuration-store.js';
export type InventoryFile={storage_key:string;modified_at:string;bytes:number;hash:string};
function inside(root:string,path:string){const r=relative(root,path);if(isAbsolute(r)||r==='..'||r.startsWith(`..${sep}`))throw new Error('retention_outside_root');}
async function fileHash(path:string){const handle=await open(path,'r');try{const digest=createHash('sha256');for await(const chunk of handle.createReadStream({autoClose:false,highWaterMark:256*1024}))digest.update(chunk);return digest.digest('hex');}finally{await handle.close();}}
/** Não segue links/reparse points. Hash identifica os bytes examinados no dry-run. */
export async function inventoryAssets(directory:string):Promise<InventoryFile[]>{
 let root:string;try{root=await realpath(directory);}catch(error){if(error instanceof Error&&'code'in error&&error.code==='ENOENT')return[];throw error;}
 const files:InventoryFile[]=[];
 async function walk(path:string){for(const entry of await readdir(path,{withFileTypes:true})){
  const child=join(path,entry.name),s=await lstat(child);if(s.isSymbolicLink())throw new Error('retention_symlink_refused');
  const actual=await realpath(child);inside(root,actual);
  if(s.isDirectory())await walk(actual);else if(s.isFile())files.push({storage_key:relative(root,actual).split(sep).join('/'),modified_at:s.mtime.toISOString(),bytes:s.size,hash:await fileHash(actual)});
 }}await walk(root);return files.sort((a,b)=>a.storage_key.localeCompare(b.storage_key));
}
export async function retentionReferences(db:Pick<SqlDatabase,'query'>,backupKeys:ReadonlySet<string>){
 const keys=new Set(backupKeys);
 for(const row of (await db.query("SELECT record->'file'->>'storage_key' AS storage_key FROM media_revisions WHERE kind='asset' UNION SELECT storage_key FROM delivery_manifests UNION SELECT output->>'storage_key' AS storage_key FROM synthetic_generation_results CROSS JOIN LATERAL jsonb_array_elements(record->'outputs') output")).rows)
  if(typeof row.storage_key==='string')keys.add(row.storage_key);
 return keys;
}
export class RetentionService{
 constructor(private readonly db:SqlDatabase,private readonly root:string,private readonly backupEvidence:()=>Promise<{verified:boolean;keys:ReadonlySet<string>;hash:string}>,
  private readonly maintenanceGuard?:<T>(run:()=>Promise<T>)=>Promise<T>){}
 async dryRun(policy:unknown,now=new Date().toISOString()){
  const parsed=RetentionPolicySchema.parse(policy),backup=await this.backupEvidence(),files=await inventoryAssets(this.root);
  const references=await retentionReferences(this.db,backup.keys),plan=planRetention(files,references,parsed,now);
  const payload={policy:parsed,now,backup_hash:backup.hash,backup_verified:backup.verified,files,plan};return {...payload,hash:sha256(canonical(payload))};
 }
 async execute(expectedHash:string,policy:unknown,now:string,authorization:{enabled:boolean;policy_approved:boolean;backup_hash:string}){
  if(!authorization.enabled||!authorization.policy_approved)throw new Error('retention_execution_disabled');
  // Guard precisa excluir também transferências/putImmutable fora de transações SQL.
  if(!this.maintenanceGuard)throw new Error('retention_maintenance_guard_required');
  return this.maintenanceGuard(async()=>{
  const backup=await this.backupEvidence();if(!backup.verified||backup.hash!==authorization.backup_hash)throw new Error('retention_verified_backup_required');
  const dry=await this.dryRun(policy,now);if(dry.hash!==expectedHash||dry.backup_hash!==backup.hash)throw new Error('retention_inventory_changed');
  const root=await realpath(resolve(this.root)),removed:string[]=[],skipped:string[]=[];
  // SHARE bloqueia INSERT/UPDATE/DELETE dos publishers. O lock cobre a última checagem e unlink.
  await this.db.transaction(async client=>{
   await client.query("SET LOCAL lock_timeout='5s'");
   await client.query('LOCK TABLE media_heads,media_revisions,delivery_manifests,synthetic_generation_results IN SHARE MODE');
   const refs=await retentionReferences(client,backup.keys);
   for(const item of dry.plan.filter(item=>item.action==='eligible_for_removal')){
    if(refs.has(item.storage_key)){skipped.push(item.storage_key);continue;}
    const path=resolve(root,...item.storage_key.split('/'));inside(root,path);
    const stat=await lstat(path);if(stat.isSymbolicLink()||!stat.isFile())throw new Error('retention_file_changed');
    const actual=await realpath(path);inside(root,actual);
    const old=dry.files.find(file=>file.storage_key===item.storage_key)!;
    if(stat.mtime.toISOString()!==old.modified_at||stat.size!==old.bytes||await fileHash(actual)!==old.hash)throw new Error('retention_file_changed');
    await unlink(actual);removed.push(item.storage_key);
   }
  });return {dry_run_hash:expectedHash,removed,skipped};
  });
 }
}
