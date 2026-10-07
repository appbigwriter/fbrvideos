import {z} from 'zod';
import {IdSchema,VersionRefSchema,ProductionSchema,ApprovalSchema,GenerationExecutionSchema,DossierSchema} from '@fbr/contracts';
import {CalibrationObservationSchema,calibrationReport,canonical,sha256} from '@fbr/domain';
import type {SqlDatabase,SqlClient} from './configuration-store.js';

export const CalibrationEvidenceSchema=z.strictObject({id:IdSchema,version:z.int().positive(),observation:CalibrationObservationSchema,
 recorded_by:z.string().trim().min(1).max(200),evidence:z.array(z.string().trim().min(1).max(2000)).min(1).max(100),recorded_at:z.iso.datetime(),sample_type:z.enum(['real','synthetic','unknown']).optional()});
const TargetsSchema=z.strictObject({minimum_samples:z.int().positive().max(10000),approval_rate:z.number().min(0).max(1)});
export class CalibrationService{
 constructor(private readonly db:SqlDatabase){}
 async append(raw:unknown){
  const record=CalibrationEvidenceSchema.parse(raw),o=record.observation,fingerprint=sha256(canonical(record));
  return this.db.transaction(async client=>{
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`calibration-production:${o.production.id}:${o.production.version}`]);
   const existing=(await client.query('SELECT fingerprint,record FROM calibration_observations WHERE id=$1 AND version=$2',[record.id,record.version])).rows[0];
   if(existing){if(existing.fingerprint!==fingerprint)throw new Error('calibration_revision_conflict');return CalibrationEvidenceSchema.parse(existing.record);}
   const latest=(await client.query('SELECT version,production_id,production_version,profile_id,profile_version FROM calibration_observations WHERE id=$1 ORDER BY version DESC LIMIT 1',[record.id])).rows[0];
   if(record.version!==Number(latest?.version??0)+1)throw new Error('calibration_version_conflict');
   if(latest&&(latest.production_id!==o.production.id||Number(latest.production_version)!==o.production.version||latest.profile_id!==o.profile.id||Number(latest.profile_version)!==o.profile.version))throw new Error('calibration_identity_changed');
   const row=(await client.query('SELECT record FROM production_revisions WHERE id=$1 AND version=$2',[o.production.id,o.production.version])).rows[0];
   if(!row)throw new Error('calibration_production_missing');
   const production=ProductionSchema.parse(row.record);
   const dossierRow=production.dossier?(await client.query('SELECT record FROM production_dossiers WHERE id=$1 AND version=$2',[production.dossier.id,production.dossier.version])).rows[0]:null;
   const assets=dossierRow?DossierSchema.parse(dossierRow.record).assets:[];
   const sampleType=assets.some(asset=>asset.origin==='fixture')?'synthetic':assets.some(asset=>asset.origin==='provider')?'real':'unknown';
   if(record.sample_type!==undefined&&record.sample_type!==sampleType)throw new Error('calibration_sample_type_mismatch');
   if(production.profile.id!==o.profile.id||production.profile.version!==o.profile.version)throw new Error('calibration_profile_mismatch');
   if(o.approved&&(!production.current_approval||!['approved','exported'].includes(production.status)))throw new Error('calibration_approval_evidence_missing');
   if(o.approved){
    const approval=(await client.query("SELECT record FROM media_revisions WHERE kind='approval' AND id=$1 AND version=$2",[production.current_approval!.id,production.current_approval!.version])).rows[0];
    const parsed=approval?ApprovalSchema.parse(approval.record):null;
    if(!parsed||parsed.kind!=='final'||parsed.status!=='active'||parsed.target.id!==production.current_render?.id||parsed.target.version!==production.current_render?.version)throw new Error('calibration_approval_evidence_missing');
   }
   if(o.currency!==production.costs.currency||(o.confirmed_minor!==null&&o.confirmed_minor!==production.costs.confirmed_minor))throw new Error('calibration_cost_evidence_mismatch');
   if(o.confirmed_minor!==null){
    const executions=(await client.query('SELECT r.record FROM generation_revisions r JOIN generation_heads h USING(id,version) WHERE h.production_id=$1',[production.id])).rows.map(row=>GenerationExecutionSchema.parse(row.record));
    if(production.costs.committed_minor>0||executions.some(execution=>!['succeeded','failed','cancelled'].includes(execution.state)||(execution.provider_job&&execution.provider_job.costs.confirmed_minor===null)))throw new Error('calibration_cost_unresolved');
   }
   const duplicate=(await client.query('SELECT id FROM calibration_observations WHERE production_id=$1 AND production_version=$2 AND id<>$3 LIMIT 1',[o.production.id,o.production.version,record.id])).rows[0];
   if(duplicate)throw new Error('calibration_duplicate_production');
   const saved={...record,sample_type:sampleType};
   await client.query('INSERT INTO calibration_observations(id,version,production_id,production_version,profile_id,profile_version,fingerprint,record) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',[record.id,record.version,o.production.id,o.production.version,o.profile.id,o.profile.version,fingerprint,JSON.stringify(saved)]);
   return saved;
  });
 }
 async report(rawProfile:unknown,rawTargets:unknown,client:SqlClient=this.db){
  const profile=VersionRefSchema.parse(rawProfile),targets=TargetsSchema.parse(rawTargets);
  const rows=(await client.query('SELECT DISTINCT ON(production_id) record FROM calibration_observations WHERE profile_id=$1 AND profile_version=$2 ORDER BY production_id,production_version DESC,version DESC',[profile.id,profile.version])).rows;
  const evidence=rows.map(row=>CalibrationEvidenceSchema.parse(row.record));
  const calculate=(items:typeof evidence)=>{const report=calibrationReport(items.map(row=>row.observation),targets);return items.length?report:{...report,confirmed_minor:null,human_minutes:null};};
  const real_report=calculate(evidence.filter(row=>row.sample_type==='real'));
  const report={...calculate(evidence),targets_met:real_report.targets_met};
  const sample_counts={real:evidence.filter(row=>row.sample_type==='real').length,synthetic:evidence.filter(row=>row.sample_type==='synthetic').length,unknown:evidence.filter(row=>!row.sample_type||row.sample_type==='unknown').length};
  const payload={profile,targets,report,real_report,sample_counts,evidence};return {...payload,hash:sha256(canonical(payload))};
 }
 async decide(raw:unknown){
  const decision=z.strictObject({id:IdSchema,profile:VersionRefSchema,targets:TargetsSchema,report_hash:z.string().regex(/^[a-f0-9]{64}$/),
   human_reviewed:z.literal(true),outcome:z.enum(['validated','rejected']),reviewer:z.string().trim().min(1).max(200),reason:z.string().trim().min(1).max(4000),recorded_at:z.iso.datetime()}).parse(raw);
  return this.db.transaction(async client=>{
  await client.query('LOCK TABLE calibration_observations IN SHARE MODE');
  const report=await this.report(decision.profile,decision.targets,client);
  if(report.hash!==decision.report_hash)throw new Error('calibration_report_changed');
  if(decision.outcome==='validated'&&!report.real_report.targets_met)throw new Error('calibration_targets_not_met');
  // A decisão é evidência separada: não muda o status do perfil nem inventa aprovação.
  await client.query('INSERT INTO calibration_profile_decisions(id,profile_id,profile_version,report_hash,record) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(id) DO NOTHING',[decision.id,decision.profile.id,decision.profile.version,decision.report_hash,JSON.stringify(decision)]);
  const saved=(await client.query('SELECT record FROM calibration_profile_decisions WHERE id=$1',[decision.id])).rows[0]?.record;
  if(canonical(saved)!==canonical(decision))throw new Error('calibration_decision_conflict');return decision;
  });
 }
}
