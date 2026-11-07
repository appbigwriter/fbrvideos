import {z} from 'zod';
import {ReferenceSchema,IdSchema,VersionRefSchema,type Reference,type AssetStore} from '@fbr/contracts';
import {ApplicationError,canonical,sha256} from '@fbr/domain';
import type {SqlDatabase,SqlClient} from './configuration-store.js';
import {probeLocalMedia} from './media-probe.js';
import {createHash} from 'node:crypto';
const bytesHash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const command={command_id:IdSchema,reference:VersionRefSchema};
/** Reference files live in immutable configuration revisions so backups retain historical uses. */
export class ReferenceMediaService{
 constructor(private db:SqlDatabase,private files:AssetStore){}
 private async current(client:SqlClient,id:string,lock=false){
  const head=(await client.query(`SELECT version FROM configuration_heads WHERE kind='references' AND id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];
  if(!head)throw new ApplicationError('not_found','Referência não encontrada.');
  return ReferenceSchema.parse((await client.query("SELECT record FROM configuration_revisions WHERE kind='references' AND id=$1 AND version=$2",[id,head.version])).rows[0]?.record);
 }
 private async change(raw:{command_id:string;reference:{id:string;version:number}},fingerprint:string,run:(old:Reference)=>Promise<Reference>){
  return this.db.transaction(async client=>{
   const key=`reference-media:${raw.command_id}`;await client.query('INSERT INTO configuration_commands(command_id,fingerprint) VALUES($1,$2) ON CONFLICT DO NOTHING',[key,fingerprint]);
   const command=(await client.query('SELECT fingerprint,result FROM configuration_commands WHERE command_id=$1 FOR UPDATE',[key])).rows[0]!;
   if(command.fingerprint!==fingerprint)throw new ApplicationError('conflict','Comando reutilizado com outros dados.');
   if(command.result)return ReferenceSchema.parse(command.result);
   const old=await this.current(client,raw.reference.id,true);if(old.version!==raw.reference.version)throw new ApplicationError('conflict','Referência alterada; recarregue antes de decidir.');
   const next=ReferenceSchema.parse(await run(old));
   await client.query("INSERT INTO configuration_revisions(kind,id,version,record) VALUES('references',$1,$2,$3::jsonb)",[old.id,next.version,JSON.stringify(next)]);
   await client.query("UPDATE configuration_heads SET version=$2 WHERE kind='references' AND id=$1",[old.id,next.version]);
   await client.query('UPDATE configuration_commands SET result=$2::jsonb WHERE command_id=$1',[key,JSON.stringify(next)]);return next;
  });
 }
 async upload(raw:unknown){
  const request=z.strictObject({...command,type:z.enum(['image','audio','clip']),base64:z.string().min(4).max(26_666_668).regex(/^[A-Za-z0-9+/]+={0,2}$/)}).parse(raw);
  const bytes=Buffer.from(request.base64,'base64');if(!bytes.length||bytes.length>20_000_000||bytes.toString('base64')!==request.base64)throw new ApplicationError('validation','Arquivo inválido ou maior que 20 MB.');
  let probe;try{probe=await probeLocalMedia(bytes,request.type);}catch{throw new ApplicationError('validation','Mídia inválida. Use PNG, JPEG, WebP, WAV, MP3 ou MP4 compatível com o tipo informado.');}
  const hash=bytesHash(bytes),file={id:`reference_file_${hash}`,version:1 as const,storage_key:`references/${hash}.bin`,hash,bytes:bytes.length,...probe};
  await this.files.putImmutable(file.storage_key,bytes,hash);
  return this.change(request,sha256(canonical({...request,base64:hash})),async old=>{
   if(old.status==='archived'||(old.media_files?.length??0)>=20)throw new ApplicationError('ineligible','Referência arquivada ou limite de arquivos atingido.');
   if(old.media_files?.some(f=>f.hash===hash))throw new ApplicationError('conflict','Arquivo já vinculado à referência.');
   if(old.kind==='voice'&&request.type!=='audio')throw new ApplicationError('validation','Referência vocal exige áudio.');
   const at=new Date().toISOString(),{media_review,...body}=old;
   return{...body,version:old.version+1,status:'pending',created_at:at,author:'reference_upload',changes:[...old.changes,{at,author:'reference_upload',reason:'Arquivo copiado, medido e vinculado por hash; revisão humana pendente.'}],asset_refs:[...old.asset_refs,{id:file.id,version:1}],media_files:[...(old.media_files??[]),file]};
  });
 }
 async approve(raw:unknown){
  const request=z.strictObject({...command,reviewer:z.string().trim().min(1).max(200),reason:z.string().trim().min(1).max(4000),reviewed_in_full:z.literal(true),rights_confirmed:z.literal(true)}).parse(raw);
  return this.change(request,sha256(canonical(request)),async old=>{
   if(old.status==='archived'||!old.media_files?.length||old.usage_permission!=='allowed')throw new ApplicationError('ineligible','Aprovação exige mídia vinculada e uso permitido.');
   for(const file of old.media_files){const bytes=await this.files.read(file.storage_key);if(bytes.length!==file.bytes||bytesHash(bytes)!==file.hash)throw new ApplicationError('ineligible','Arquivo ausente ou corrompido.');}
   const at=new Date().toISOString();return{...old,version:old.version+1,status:'approved',created_at:at,author:'reference_review',changes:[...old.changes,{at,author:'reference_review',reason:request.reason}],media_review:{reviewer:request.reviewer,reason:request.reason,reviewed_at:at,reviewed_in_full:true,rights_confirmed:true}};
  });
 }
 async file(id:string,version:number,fileId:string){
  const row=(await this.db.query("SELECT record FROM configuration_revisions WHERE kind='references' AND id=$1 AND version=$2",[id,version])).rows[0];
  const reference=row?ReferenceSchema.parse(row.record):null,file=reference?.media_files?.find(f=>f.id===fileId);
  if(!file)throw new ApplicationError('not_found','Arquivo não pertence a esta revisão de referência.');
  const bytes=await this.files.read(file.storage_key);if(bytes.length!==file.bytes||bytesHash(bytes)!==file.hash)throw new ApplicationError('ineligible','Arquivo ausente ou corrompido.');
  return{bytes,mime_type:file.mime_type};
 }
}
