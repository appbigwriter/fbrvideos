import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPilotPackage,inspectPilot,newPilotEvidence,pilotCriteria} from '../pilot-evidence.ts';

async function fixture(run:(directory:string)=>Promise<void>){const directory=await mkdtemp(join(tmpdir(),'fbr-pilot-evidence-'));try{await run(directory);}finally{await rm(directory,{recursive:true,force:true});}}
test('package initializer refuses an existing directory and never replaces evidence',async()=>fixture(async directory=>{
  const path=await createPilotPackage(join(directory,'new'),'pilot-001');const before=await readFile(path,'utf8');
  await assert.rejects(createPilotPackage(join(directory,'new'),'pilot-002'));
  assert.equal(await readFile(path,'utf8'),before);
  const report=await inspectPilot(path);assert.equal(report.inventory_complete,false);assert.equal(report.verified_files,0);
  assert(report.issues.some(issue=>issue.code==='real_sample_missing'));
  assert.equal(report.product_acceptance,'requires_authorized_human_decision');
}));

test('hashes, linked reviews, billing and explicit evidence are required; inventory never grants acceptance',async()=>fixture(async directory=>{
  const contents=Buffer.from('test evidence; not real media');const sha256=createHash('sha256').update(contents).digest('hex');await writeFile(join(directory,'evidence.bin'),contents);
  const manifest=newPilotEvidence('pilot-001');manifest.sample_type='real';manifest.production={id:'prod-1',version:1};manifest.profile={id:'profile-1',version:1};
  manifest.files=['article','bible','reference','voice','render','srt','vtt','manifest','report'].map(role=>({id:role,role:role as typeof manifest.files[number]['role'],path:'evidence.bin',sha256,bytes:contents.length}));
  manifest.setup={reviewer:'Test declaration',rights_evidence:['report'],recipe:'test recipe',format:'test format',rubric_evidence:['report'],currency:'BRL',ceiling_minor:100,authorization_evidence:['report']};
  manifest.routes=['audio','image','animation','avatar'].map(operation=>({operation:operation as typeof manifest.routes[number]['operation'],provider:'test declaration',model:'test',external_job_id:operation,confirmed_minor:0,evidence:['report']}));
  manifest.reviews=pilotCriteria.map(criterion=>({criterion,outcome:'pass',reviewer:'Test declaration',recorded_at:'2026-10-28T12:00:00Z',render_sha256:sha256,evidence:['report'],reason:'Test record only'}));
  manifest.calibration={report_evidence:['report'],decision_evidence:['report']};const path=join(directory,'pilot-evidence.json');await writeFile(path,JSON.stringify(manifest));
  let result=await inspectPilot(path);assert.equal(result.inventory_complete,true);assert.equal(result.product_acceptance,'requires_authorized_human_decision');
  manifest.routes[0]!.confirmed_minor=null;manifest.reviews[0]!.render_sha256='0'.repeat(64);manifest.reviews[1]!.outcome='fail';await writeFile(path,JSON.stringify(manifest));
  result=await inspectPilot(path);assert(result.issues.some(issue=>issue.code==='billing_unresolved'));assert(result.issues.some(issue=>issue.code==='review_render_mismatch'));assert(result.issues.some(issue=>issue.code==='human_review_failed'));
  await writeFile(join(directory,'evidence.bin'),'changed');result=await inspectPilot(path);assert.equal(result.inventory_complete,false);assert.equal(result.verified_files,0);
}));

test('evidence paths cannot escape the package and duplicate IDs cannot satisfy references',async()=>fixture(async directory=>{
  const contents=Buffer.from('outside');await writeFile(join(directory,'outside.txt'),contents);const path=await createPilotPackage(join(directory,'package'),'pilot-001');
  const manifest=newPilotEvidence('pilot-001');manifest.files=[{id:'outside',role:'report',path:'../outside.txt',sha256:createHash('sha256').update(contents).digest('hex'),bytes:contents.length}];
  manifest.setup.rights_evidence=['outside'];await writeFile(path,JSON.stringify(manifest));let result=await inspectPilot(path);assert(result.issues.some(issue=>issue.code==='file_unavailable_or_outside_package'));
  manifest.files.push({...manifest.files[0]!});await writeFile(path,JSON.stringify(manifest));result=await inspectPilot(path);assert.equal(result.verified_files,0);assert(result.issues.some(issue=>issue.code==='duplicate_file_id'));assert(result.issues.some(issue=>issue.code==='evidence_unavailable'));
}));
