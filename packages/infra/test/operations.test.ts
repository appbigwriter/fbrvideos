import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PGlite} from '@electric-sql/pglite';
import {productionFixture,imageFixture} from '@fbr/contracts/fixtures';
import {ConfigurationService,sha256,planRetention,calibrationReport} from '@fbr/domain';
import {buildApp} from '../../../apps/api/src/app.js';
import {PostgresConfigurationStore,migrateConfiguration,type SqlClient,type SqlDatabase,LocalImmutableAssetStore,captureFullBackup,restoreFullBackup,operationalState,OperationalTelemetry,PostgresHttpTransmissionJournal} from '../src/index.js';
function database(){const engine=new PGlite();const wrap=(c:Pick<PGlite,'query'|'exec'>):SqlClient=>({async query(sql,values){
  if(values===undefined){const result=(await c.exec(sql)).at(-1);return {rows:result?.rows as Record<string,unknown>[]??[],rowCount:result?.affectedRows??0};}
  const result=await c.query<Record<string,unknown>>(sql,values);return{rows:result.rows,rowCount:result.affectedRows??0};
}});const db:SqlDatabase={...wrap(engine),transaction:run=>engine.transaction(tx=>run(wrap(tx)))};return {db,engine};}
test('Acesso privado protege APIs/mídia, sessão HttpOnly é revogável e métricas não expõem chave',async()=>{
  const {db,engine}=database();await migrateConfiguration(db);const token='fixture-test-access-token-32-characters';
  const app=buildApp(new ConfigurationService(new PostgresConfigurationStore(db)),{accessToken:token,secureCookie:true,operationalState:()=>operationalState(db)});
  try{
    assert.equal((await app.inject({method:'GET',url:'/api/operations'})).statusCode,401);
    assert.equal((await app.inject({method:'POST',url:'/api/session',payload:{token:'wrong'}})).statusCode,401);
    const login=await app.inject({method:'POST',url:'/api/session',payload:{token}});assert.equal(login.statusCode,200);
    const raw=String(login.headers['set-cookie']);assert.ok(raw.includes('HttpOnly'));assert.ok(raw.includes('Secure'));assert.ok(raw.includes('SameSite=Strict'));
    const cookie=raw.split(';')[0]!;
    const metrics=await app.inject({method:'GET',url:'/api/operations',headers:{cookie}});assert.equal(metrics.statusCode,200);assert.equal(metrics.body.includes(token),false);
    assert.equal((await app.inject({method:'GET',url:'/api/operations',headers:{authorization:`Bearer ${token}`}})).statusCode,200);
    assert.equal((await app.inject({method:'POST',url:'/api/session/logout',headers:{cookie}})).statusCode,200);
    assert.equal((await app.inject({method:'GET',url:'/api/operations',headers:{cookie}})).statusCode,401);
    assert.equal((await app.inject({method:'POST',url:'/api/session',headers:{origin:'https://untrusted.example'},payload:{token}})).statusCode,403);
  }finally{await app.close();await engine.close();}
});
test('Backup completo conserva mídia histórica e restaura somente após verificar integridade',async()=>{
  const source=database(),target=database(),root=await mkdtemp(join(tmpdir(),'fbr-full-backup-test-'));
  try{
    await migrateConfiguration(source.db);await migrateConfiguration(target.db);
    const live=new LocalImmutableAssetStore(join(root,'live')),archive=new LocalImmutableAssetStore(join(root,'archive')),restored=new LocalImmutableAssetStore(join(root,'restored'));
    const bytes=new TextEncoder().encode('Arquivo sintético do backup completo.'),hash=sha256(new TextDecoder().decode(bytes)),key=`images/${hash}.bin`;
    await live.putImmutable(key,bytes,hash);
    const asset={...imageFixture,file:{...imageFixture.file,storage_key:key,hash,bytes:bytes.length}},p=productionFixture;
    await source.db.query('INSERT INTO production_heads(id,version) VALUES($1,1)',[p.id]);
    await source.db.query('INSERT INTO production_revisions(id,version,record) VALUES($1,1,$2::jsonb)',[p.id,JSON.stringify(p)]);
    const journal=new PostgresHttpTransmissionJournal(source.db),request={contract_version:'0.1.0' as const,execution_key:sha256('backup-http'),attempt:1,production:{id:p.id,version:1},shot:null,
      operation:'audio' as const,route:null,input_assets:[],references:[],configuration_hash:sha256('config'),parameters:{text:'Teste'},currency:'BRL',reserved_minor:0};
    const payload={origin:'https://provider.example',account_scope:'fixture_account',path:'/submit',body:request.parameters};
    await journal.pin('fixture_adapter',request,payload);await new PostgresHttpTransmissionJournal(source.db).pin('fixture_adapter',request,payload);
    await assert.rejects(journal.pin('fixture_adapter',request,{...payload,account_scope:'different_account'}),/intention_changed/);
    await source.db.query("INSERT INTO media_heads(kind,id,production_id,version) VALUES('asset',$1,$2,1)",[asset.id,p.id]);
    await source.db.query("INSERT INTO media_revisions(kind,id,version,record) VALUES('asset',$1,1,$2::jsonb)",[asset.id,JSON.stringify(asset)]);
    const backup=await captureFullBackup(source.db,live,archive);assert.equal(backup.files,1);
    await assert.rejects(restoreFullBackup(target.db,archive,restored,backup.metadata_key,'f'.repeat(64)),/metadata_corrupt/);
    const result=await restoreFullBackup(target.db,archive,restored,backup.metadata_key,backup.metadata_hash);assert.equal(result.files,1);assert.equal(await restored.exists(asset),true);
    await new PostgresHttpTransmissionJournal(target.db).pin('fixture_adapter',request,payload);
    await assert.rejects(new PostgresHttpTransmissionJournal(target.db).pin('fixture_adapter',request,{...payload,path:'/other'}),/intention_changed/);
    await assert.rejects(restoreFullBackup(target.db,archive,restored,backup.metadata_key,backup.metadata_hash),/requires_empty/);
  }finally{await source.engine.close();await target.engine.close();assert.ok(root.startsWith(join(tmpdir(),'fbr-full-backup-test-')));await rm(root,{recursive:true,force:true});}
});
test('Retenção conserva referências/histórico e telemetria agrega somente rotas fixas',()=>{
  const now='2026-10-06T00:00:00Z',old='2026-01-01T00:00:00Z';
  const plan=planRetention([{storage_key:'historical.mp4',modified_at:old},{storage_key:'recent.mp4',modified_at:now},{storage_key:'orphan.mp4',modified_at:old}],new Set(['historical.mp4']),{keep_referenced:true,orphan_grace_days:30},now);
  assert.deepEqual(plan.map(file=>file.action),['keep','keep','eligible_for_removal']);
  const telemetry=new OperationalTelemetry();telemetry.observe('GET','/api/productions/:id',200,10);telemetry.observe('GET','/api/productions/:id',500,20);
  assert.equal(telemetry.snapshot().routes[0]!.mean_ms,15);assert.equal(telemetry.snapshot().routes[0]!.errors,1);
});
test('Relatório de calibração não transforma ausência de revisão/custo em aceite',()=>{
  const sample={production:{id:'p',version:1},profile:{id:'profile',version:1},article_class:'explanation',format:'160x240@30',human_reviewed:false,approved:false,
    corrections:1,fallbacks:0,currency:'BRL',confirmed_minor:null,human_minutes:null};
  const report=calibrationReport([sample],{minimum_samples:1,approval_rate:0.8});assert.equal(report.targets_met,false);assert.equal(report.confirmed_minor,null);
  assert.equal(report.automatic_profile_validation,false);
  assert.throws(()=>calibrationReport([{...sample,approved:true}],{minimum_samples:1,approval_rate:0.8}));
  assert.throws(()=>calibrationReport([sample,sample],{minimum_samples:1,approval_rate:0.8}),/duplicate/);
});
