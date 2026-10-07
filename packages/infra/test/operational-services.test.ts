import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,utimes,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PGlite} from '@electric-sql/pglite';
import {productionFixture,dossierFixture,approvalFixture} from '@fbr/contracts/fixtures';
import {CalibrationService} from '../src/calibration-service.js';
import {RetentionService,inventoryAssets} from '../src/retention-service.js';
import {operationalReadiness} from '../src/operational-readiness.js';
import {migrateConfiguration,type SqlClient,type SqlDatabase} from '../src/configuration-store.js';
function database(){const engine=new PGlite();const wrap=(c:Pick<PGlite,'query'|'exec'>):SqlClient=>({async query(sql,values){
 if(values===undefined){const result=(await c.exec(sql)).at(-1);return{rows:result?.rows as Record<string,unknown>[]??[],rowCount:result?.affectedRows??0};}
 const result=await c.query<Record<string,unknown>>(sql,values);return{rows:result.rows,rowCount:result.affectedRows??0};
}});const db:SqlDatabase={...wrap(engine),transaction:run=>engine.transaction(tx=>run(wrap(tx)))};return{db,engine};}
test('Calibração persiste revisões, preserva desconhecidos e recusa aceite fabricado',async()=>{
 const {db,engine}=database();try{
  await migrateConfiguration(db);await db.query(await readFile(new URL('../migrations/011_operations.sql',import.meta.url),'utf8'));
  const p=productionFixture;await db.query('INSERT INTO production_heads(id,version) VALUES($1,1)',[p.id]);await db.query('INSERT INTO production_revisions(id,version,record) VALUES($1,1,$2::jsonb)',[p.id,JSON.stringify(p)]);
  const service=new CalibrationService(db),record={id:'observation_test',version:1,recorded_by:'Operador de ensaio',recorded_at:'2026-10-06T12:00:00Z',evidence:['Ensaio sintético: não é aceite editorial.'],
   observation:{production:{id:p.id,version:1},profile:p.profile,article_class:'explanation',format:'1080x1920@30',human_reviewed:false,approved:false,corrections:0,fallbacks:0,currency:'BRL',confirmed_minor:null,human_minutes:null}};
  await service.append(record);await service.append(record);
  await assert.rejects(service.append({...record,evidence:['Dados diferentes']}),/revision_conflict/);
  await assert.rejects(service.append({...record,version:2,observation:{...record.observation,human_reviewed:true,approved:true}}),/approval_evidence_missing/);
  const report=await service.report(p.profile,{minimum_samples:1,approval_rate:0.8});assert.equal(report.report.samples,1);assert.equal(report.report.confirmed_minor,null);assert.equal(report.report.targets_met,false);
  await assert.rejects(service.decide({id:'decision_test',profile:p.profile,targets:report.targets,report_hash:report.hash,human_reviewed:true,outcome:'validated',reviewer:'Operador',reason:'Revisão',recorded_at:record.recorded_at}),/targets_not_met/);
  await service.append({...record,version:2,observation:{...record.observation,confirmed_minor:0,human_minutes:3}});
  assert.equal((await service.report(p.profile,report.targets)).report.samples,1);
  await assert.rejects(service.decide({id:'decision_test',profile:p.profile,targets:report.targets,report_hash:report.hash,human_reviewed:true,outcome:'rejected',reviewer:'Operador',reason:'Revisão',recorded_at:record.recorded_at}),/report_changed/);
 }finally{await engine.close();}
});
test('Retenção executa apenas dry-run exato sob guard e exige backup verificado',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fbr-retention-test-'));let locked=false,verified=true;
 const db:SqlDatabase={async query(sql){if(sql.includes('LOCK TABLE'))locked=true;return{rows:[],rowCount:0};},transaction:async run=>run(db)};
 try{
  await writeFile(join(root,'orphan.bin'),'arquivo órfão sintético');await utimes(join(root,'orphan.bin'),new Date('2026-01-01'),new Date('2026-01-01'));
  const backup=async()=>({verified,keys:new Set<string>(),hash:'b'.repeat(64)}),service=new RetentionService(db,root,backup,async run=>run()),policy={keep_referenced:true as const,orphan_grace_days:30};
  const dry=await service.dryRun(policy,'2026-10-06T12:00:00Z'),authorization={enabled:true,policy_approved:true,backup_hash:dry.backup_hash};
  verified=false;await assert.rejects(service.execute(dry.hash,policy,dry.now,authorization),/verified_backup_required/);verified=true;
  const result=await service.execute(dry.hash,policy,dry.now,authorization);assert.deepEqual(result.removed,['orphan.bin']);assert.equal(locked,true);
  await assert.rejects(readFile(join(root,'orphan.bin')),error=>error instanceof Error&&'code'in error&&error.code==='ENOENT');
 }finally{assert.ok(root.startsWith(join(tmpdir(),'fbr-retention-test-')));await rm(root,{recursive:true,force:true});}
});
test('Readiness diferencia conexão do schema e não expõe erro/credenciais',async()=>{
 const db:SqlDatabase={async query(){return{rows:[{table_name:'production_heads'}],rowCount:1};},transaction:async run=>run(db)};
 const missing=await operationalReadiness(db,false);assert.equal(missing.ready,false);assert.equal(missing.checks[0]!.ready,true);assert.equal(missing.checks[1]!.diagnostic,'required_tables_missing');
 db.query=async()=>{throw new Error('secret DATABASE_URL')};const unavailable=await operationalReadiness(db,false);assert.equal(unavailable.ready,false);assert.equal(JSON.stringify(unavailable).includes('secret'),false);
});
test('Revisões da mesma produção contam uma amostra e fixtures nunca validam perfil real',async()=>{
 const {db,engine}=database();try{
  await migrateConfiguration(db);
  const p={...productionFixture,status:'approved',current_approval:{id:approvalFixture.id,version:approvalFixture.version}};
  await db.query('INSERT INTO production_heads(id,version) VALUES($1,2)',[p.id]);
  for(const version of [1,2])await db.query('INSERT INTO production_revisions(id,version,record) VALUES($1,$2,$3::jsonb)',[p.id,version,JSON.stringify({...p,version})]);
  await db.query('INSERT INTO production_dossiers(id,version,record) VALUES($1,$2,$3::jsonb)',[dossierFixture.id,dossierFixture.version,JSON.stringify(dossierFixture)]);
  await db.query("INSERT INTO media_heads(kind,id,production_id,version) VALUES('approval',$1,$2,1)",[approvalFixture.id,p.id]);
  await db.query("INSERT INTO media_revisions(kind,id,version,record) VALUES('approval',$1,1,$2::jsonb)",[approvalFixture.id,JSON.stringify(approvalFixture)]);
  const service=new CalibrationService(db),record={id:'sample_version_1',version:1,recorded_by:'Operador sintético',recorded_at:'2026-10-06T12:00:00Z',evidence:['Aceite técnico de fixture, não editorial'],observation:{production:{id:p.id,version:1},profile:p.profile,article_class:'explanation',format:'1080x1920@30',human_reviewed:true,approved:true,corrections:0,fallbacks:0,currency:'BRL',confirmed_minor:0,human_minutes:2}};
  await assert.rejects(service.append({...record,sample_type:'real'}),/sample_type_mismatch/);
  assert.equal((await service.append(record)).sample_type,'synthetic');
  await service.append({...record,id:'sample_version_2',observation:{...record.observation,production:{id:p.id,version:2}}});
  const report=await service.report(p.profile,{minimum_samples:1,approval_rate:0.8});assert.equal(report.report.samples,1);assert.equal(report.report.approved,1);assert.equal(report.sample_counts.synthetic,1);assert.equal(report.real_report.samples,0);assert.equal(report.report.targets_met,false);
  await assert.rejects(service.decide({id:'synthetic_decision',profile:p.profile,targets:report.targets,report_hash:report.hash,human_reviewed:true,outcome:'validated',reviewer:'Operador',reason:'Fixture aprovada',recorded_at:record.recorded_at}),/targets_not_met/);
 }finally{await engine.close();}
});
test('Instalação sem diretório de mídia produz inventário vazio e backup permanece não verificado',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fbr-retention-test-'));
 const db:SqlDatabase={async query(){return{rows:[],rowCount:0};},transaction:async run=>run(db)};
 try{
  const missing=join(root,'never-created');assert.deepEqual(await inventoryAssets(missing),[]);
  const service=new RetentionService(db,missing,async()=>({verified:false,keys:new Set<string>(),hash:'backup_not_verified'}));
  const plan=await service.dryRun({keep_referenced:true,orphan_grace_days:30});assert.deepEqual(plan.files,[]);assert.equal(plan.backup_verified,false);
 }finally{assert.ok(root.startsWith(join(tmpdir(),'fbr-retention-test-')));await rm(root,{recursive:true,force:true});}
});
test('Retenção revalida referências concorrentes e conserva backup/histórico',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fbr-retention-test-')),references=new Set(['historical.bin']);let guard=false;
 const db:SqlDatabase={async query(sql){if(sql.includes('SELECT record'))return{rows:[...references].map(storage_key=>({storage_key})),rowCount:references.size};return{rows:[],rowCount:0};},transaction:async run=>run(db)};
 try{
  for(const key of ['historical.bin','backup.bin','orphan.bin']){await writeFile(join(root,key),key);await utimes(join(root,key),new Date('2026-01-01'),new Date('2026-01-01'));}
  const backup=async()=>({verified:true,keys:new Set(['backup.bin']),hash:'b'.repeat(64)});
  const service=new RetentionService(db,root,backup,async run=>{guard=true;references.add('orphan.bin');return run();}),policy={keep_referenced:true as const,orphan_grace_days:30};
  const dry=await service.dryRun(policy,'2026-10-06T12:00:00Z');assert.deepEqual(dry.plan.filter(p=>p.action==='eligible_for_removal').map(p=>p.storage_key),['orphan.bin']);
  await assert.rejects(service.execute(dry.hash,policy,dry.now,{enabled:false,policy_approved:true,backup_hash:dry.backup_hash}),/disabled/);
  await assert.rejects(service.execute(dry.hash,policy,dry.now,{enabled:true,policy_approved:true,backup_hash:dry.backup_hash}),/inventory_changed/);assert.equal(guard,true);
  assert.equal((await readFile(join(root,'orphan.bin'),'utf8')),'orphan.bin');
  const missingGuard=new RetentionService(db,root,backup);await assert.rejects(missingGuard.execute(dry.hash,policy,dry.now,{enabled:true,policy_approved:true,backup_hash:dry.backup_hash}),/maintenance_guard_required/);
 }finally{assert.ok(root.startsWith(join(tmpdir(),'fbr-retention-test-')));await rm(root,{recursive:true,force:true});}
});
