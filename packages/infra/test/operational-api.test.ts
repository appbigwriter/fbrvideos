import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PGlite} from '@electric-sql/pglite';
import {productionFixture} from '@fbr/contracts/fixtures';
import {ConfigurationService} from '@fbr/domain';
import {buildApp} from '../../../apps/api/src/app.js';
import {CalibrationService} from '../src/calibration-service.js';
import {RetentionService} from '../src/retention-service.js';
import {PostgresConfigurationStore,migrateConfiguration,type SqlClient,type SqlDatabase} from '../src/configuration-store.js';
function database(){const engine=new PGlite();const wrap=(c:Pick<PGlite,'query'|'exec'>):SqlClient=>({async query(sql,values){
 if(values===undefined){const result=(await c.exec(sql)).at(-1);return{rows:result?.rows as Record<string,unknown>[]??[],rowCount:result?.affectedRows??0};}
 const result=await c.query<Record<string,unknown>>(sql,values);return{rows:result.rows,rowCount:result.affectedRows??0};
}});const db:SqlDatabase={...wrap(engine),transaction:run=>engine.transaction(tx=>run(wrap(tx)))};return{db,engine};}
test('APIs operacionais exigem sessão; dry-run informa backup não verificado e não expõe descarte',async()=>{
 const {db,engine}=database(),root=await mkdtemp(join(tmpdir(),'fbr-operational-api-')),token='test-operator-token-at-least-32-characters';
 await migrateConfiguration(db);
 const retention=new RetentionService(db,root,async()=>({verified:false,keys:new Set<string>(),hash:'backup_not_verified'}));
 const app=buildApp(new ConfigurationService(new PostgresConfigurationStore(db)),{accessToken:token,calibration:new CalibrationService(db),
  readiness:async()=>({ready:false,checks:[{component:'database',ready:false,diagnostic:'database_unavailable'}]}),retentionPlan:()=>retention.dryRun({keep_referenced:true,orphan_grace_days:30})});
 try{
  for(const url of ['/api/readiness','/api/retention/plan','/api/calibration/reports?profile_id=profile&profile_version=1&minimum_samples=1&approval_rate=0.8'])assert.equal((await app.inject({method:'GET',url})).statusCode,401);
  for(const url of ['/api/calibration/observations','/api/calibration/decisions'])assert.equal((await app.inject({method:'POST',url,payload:{}})).statusCode,401);
  const headers={authorization:`Bearer ${token}`},readiness=await app.inject({method:'GET',url:'/api/readiness',headers});assert.equal(readiness.statusCode,200);assert.equal(readiness.json().ready,false);
  const plan=await app.inject({method:'GET',url:'/api/retention/plan',headers});assert.equal(plan.statusCode,200);assert.equal(plan.json().backup_verified,false);assert.equal(plan.json().backup_hash,'backup_not_verified');assert.equal(plan.json().policy.orphan_grace_days,30);assert.deepEqual(plan.json().files,[]);assert.deepEqual(plan.json().plan,[]);
  assert.equal((await app.inject({method:'POST',url:'/api/retention/execute',headers,payload:{enabled:true}})).statusCode,404);
  assert.equal((await app.inject({method:'GET',url:'/api/readiness',headers:{...headers,origin:'https://untrusted.example'}})).statusCode,403);
 }finally{await app.close();await engine.close();assert.ok(root.startsWith(join(tmpdir(),'fbr-operational-api-')));await rm(root,{recursive:true,force:true});}
});
test('Calibração via API preserva custo/tempo desconhecidos, idempotência e decisão humana explícita',async()=>{
 const {db,engine}=database();await migrateConfiguration(db);const p=productionFixture;
 await db.query('INSERT INTO production_heads(id,version) VALUES($1,1)',[p.id]);await db.query('INSERT INTO production_revisions(id,version,record) VALUES($1,1,$2::jsonb)',[p.id,JSON.stringify(p)]);
 const app=buildApp(new ConfigurationService(new PostgresConfigurationStore(db)),{calibration:new CalibrationService(db)});
 const record={id:'api_observation',version:1,recorded_by:'Operador de teste',recorded_at:'2026-10-06T12:00:00Z',evidence:['Ensaio sintético, não constitui aceite real'],observation:{production:{id:p.id,version:1},profile:p.profile,article_class:'explanation',format:'1080x1920@30',human_reviewed:false,approved:false,corrections:0,fallbacks:0,currency:'BRL',confirmed_minor:null,human_minutes:null}};
 try{
  assert.equal((await app.inject({method:'POST',url:'/api/calibration/observations',payload:record})).statusCode,200);
  assert.equal((await app.inject({method:'POST',url:'/api/calibration/observations',payload:record})).statusCode,200);
  assert.equal((await app.inject({method:'POST',url:'/api/calibration/observations',payload:{...record,command_id:'unexpected'}})).statusCode,400);
  const fabricated=await app.inject({method:'POST',url:'/api/calibration/observations',payload:{...record,version:2,observation:{...record.observation,human_reviewed:true,approved:true}}});assert.equal(fabricated.statusCode,422);assert.equal(fabricated.body.includes('SELECT'),false);
  const query=new URLSearchParams({profile_id:p.profile.id,profile_version:String(p.profile.version),minimum_samples:'1',approval_rate:'0.8'});
  const reportResponse=await app.inject({method:'GET',url:`/api/calibration/reports?${query}`});assert.equal(reportResponse.statusCode,200);const report=reportResponse.json();assert.equal(report.report.samples,1);assert.equal(report.report.confirmed_minor,null);assert.equal(report.report.human_minutes,null);assert.equal(report.report.automatic_profile_validation,false);
  assert.equal((await app.inject({method:'GET',url:`/api/calibration/reports?${query}&unexpected=1`})).statusCode,400);
  const decision={id:'api_decision',profile:p.profile,targets:report.targets,report_hash:report.hash,human_reviewed:true,outcome:'rejected',reviewer:'Operador de teste',reason:'Evidências insuficientes',recorded_at:record.recorded_at};
  assert.equal((await app.inject({method:'POST',url:'/api/calibration/decisions',payload:{...decision,human_reviewed:false}})).statusCode,400);
  assert.equal((await app.inject({method:'POST',url:'/api/calibration/decisions',payload:{...decision,outcome:'validated'}})).statusCode,422);
  assert.equal((await app.inject({method:'POST',url:'/api/calibration/decisions',payload:decision})).statusCode,200);
  assert.equal((await app.inject({method:'POST',url:'/api/calibration/decisions',payload:decision})).statusCode,200);
  assert.equal((await app.inject({method:'POST',url:'/api/calibration/decisions',payload:{...decision,reason:'Outro motivo'}})).statusCode,422);
 }finally{await app.close();await engine.close();}
});
