import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ReferenceSchema} from '@fbr/contracts';
import {ConfigurationService} from '@fbr/domain';
import {buildApp} from '../../../apps/api/src/app.js';
import {migrateConfiguration,PostgresConfigurationStore,ReferenceMediaService,LocalImmutableAssetStore,captureFullBackup,restoreFullBackup,retentionReferences,type SqlClient,type SqlDatabase} from '../src/index.js';
async function database(){const engine=new PGlite(),wrap=(client:Pick<PGlite,'query'|'exec'>):SqlClient=>({async query(sql,values){if(values===undefined){const result=(await client.exec(sql)).at(-1);return{rows:result?.rows as Record<string,unknown>[]??[],rowCount:result?.affectedRows??0};}const result=await client.query<Record<string,unknown>>(sql,values);return{rows:result.rows,rowCount:result.affectedRows??0};}});const db:SqlDatabase={...wrap(engine),transaction:run=>engine.transaction(tx=>run(wrap(tx)))};await migrateConfiguration(db);return{db,engine};}
test('Reference upload validates actual media, records consent, preserves history in backup and refuses forged ownership',async()=>{
 const {db,engine}=await database(),root=await mkdtemp(join(tmpdir(),'fbr-reference-')),files=new LocalImmutableAssetStore(join(root,'assets')),configuration=new ConfigurationService(new PostgresConfigurationStore(db)),media=new ReferenceMediaService(db,files),app=buildApp(configuration,{referenceMedia:media});
 try{
  const reference=ReferenceSchema.parse(await configuration.save('references',{command_id:randomUUID(),expected_version:null,reason:'Referência sintética.',data:{name:'Imagem sintética',kind:'style',status:'pending',usage_permission:'allowed',rules:[],asset_refs:[]}}));
  const path=join(root,'image.png');await promisify(execFile)('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=16x16','-frames:v','1','-y',path],{windowsHide:true});const bytes=await readFile(path);
  const upload={command_id:randomUUID(),reference:{id:reference.id,version:1},type:'image',base64:bytes.toString('base64')};
  const uploaded=await media.upload(upload);assert.deepEqual(await media.upload(upload),uploaded);assert.equal(uploaded.version,2);assert.equal(uploaded.status,'pending');
  await assert.rejects(media.upload({...upload,command_id:randomUUID(),reference:{id:reference.id,version:2},base64:Buffer.from('<svg/>').toString('base64')}));
  await assert.rejects(media.approve({command_id:randomUUID(),reference:{id:reference.id,version:2},reviewer:'Teste',reason:'Teste',reviewed_in_full:false,rights_confirmed:true}));
  const approved=await media.approve({command_id:randomUUID(),reference:{id:reference.id,version:2},reviewer:'Operador de ensaio',reason:'Arquivo sintético examinado; não é aceite de piloto.',reviewed_in_full:true,rights_confirmed:true});
  assert.equal(approved.status,'approved');assert.equal(approved.media_review!.reviewer,'Operador de ensaio');
  const file=uploaded.media_files![0]!;
  const preview=await app.inject({url:`/api/references/${reference.id}/media/${file.id}?version=2`,headers:{host:'localhost'}});assert.equal(preview.statusCode,200);assert.deepEqual(preview.rawPayload,bytes);
  assert.equal((await app.inject({url:`/api/references/other/media/${file.id}?version=2`,headers:{host:'localhost'}})).statusCode,404);
  const {id,version,created_at,author,changes,media_files,media_review,...data}=approved;
  const edited=ReferenceSchema.parse(await configuration.save('references',{command_id:randomUUID(),expected_version:approved.version,reason:'Alteração invalida aceite.',data:{...data,status:'pending'}},approved.id));assert.equal(edited.status,'pending');assert.equal(edited.media_review,undefined);assert.deepEqual(edited.media_files,approved.media_files);
  assert.ok((await retentionReferences(db,new Set())).has(file.storage_key));
  const backupFiles=new LocalImmutableAssetStore(join(root,'backup')),backup=await captureFullBackup(db,files,backupFiles);assert.equal(backup.files,1);
  const restored=await database();try{const target=new LocalImmutableAssetStore(join(root,'restored'));await restoreFullBackup(restored.db,backupFiles,target,backup.metadata_key,backup.metadata_hash);assert.deepEqual((await new ReferenceMediaService(restored.db,target).file(reference.id,2,file.id)).bytes,bytes);}finally{await restored.engine.close();}
 }finally{await app.close();await engine.close();await rm(root,{recursive:true,force:true});}
});
