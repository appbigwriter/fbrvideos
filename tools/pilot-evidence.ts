import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,realpath,stat,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,relative,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';

const id=z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/);
const text=z.string().trim().min(1).max(2000);
const hash=z.string().regex(/^[a-f0-9]{64}$/);
export const pilotCriteria=['fidelity','identity','voice','lip_sync','continuity','subtitles','mix','delivery','localized_correction','restart','policy_calibration'] as const;
const versionRef=z.strictObject({id,version:z.int().positive()});
export const PilotEvidenceSchema=z.strictObject({
  schema_version:z.literal('1'),pilot_id:id,sample_type:z.enum(['real','synthetic','unknown']),
  production:versionRef.nullable(),profile:versionRef.nullable(),
  files:z.array(z.strictObject({id,role:z.enum(['article','bible','reference','voice','render','srt','vtt','manifest','report']),
    path:text,sha256:hash,bytes:z.int().positive()})).max(1000),
  setup:z.strictObject({reviewer:text.nullable(),rights_evidence:z.array(id).max(100),
    recipe:text.nullable(),format:text.nullable(),rubric_evidence:z.array(id).max(100),
    currency:z.string().regex(/^[A-Z]{3}$/).nullable(),ceiling_minor:z.int().positive().nullable(),authorization_evidence:z.array(id).max(100)}),
  routes:z.array(z.strictObject({operation:z.enum(['audio','image','animation','avatar']),provider:text,model:text,
    external_job_id:text,confirmed_minor:z.int().nonnegative().nullable(),evidence:z.array(id).min(1).max(100)})).max(1000),
  reviews:z.array(z.strictObject({criterion:z.enum(pilotCriteria),outcome:z.enum(['pass','fail','not_applicable']),
    reviewer:text,recorded_at:z.iso.datetime(),render_sha256:hash,evidence:z.array(id).min(1).max(100),reason:text})).max(1000),
  calibration:z.strictObject({report_evidence:z.array(id).max(100),decision_evidence:z.array(id).max(100)})
});
export type PilotEvidence=z.infer<typeof PilotEvidenceSchema>;

export function newPilotEvidence(pilotId:string):PilotEvidence {
  return PilotEvidenceSchema.parse({schema_version:'1',pilot_id:pilotId,sample_type:'unknown',production:null,profile:null,files:[],
    setup:{reviewer:null,rights_evidence:[],recipe:null,format:null,rubric_evidence:[],currency:null,ceiling_minor:null,authorization_evidence:[]},
    routes:[],reviews:[],calibration:{report_evidence:[],decision_evidence:[]}});
}

async function fileHash(path:string) {
  const digest=createHash('sha256');let bytes=0;
  for await(const chunk of createReadStream(path)){digest.update(chunk);bytes+=chunk.length;}
  return{sha256:digest.digest('hex'),bytes};
}

/** Local inventory only. A recorded human declaration is never inferred from media or a hash. */
export async function inspectPilot(manifestPath:string) {
  const location=await realpath(manifestPath),base=await realpath(dirname(location));
  if((await stat(location)).size>2_000_000)throw new Error('pilot_manifest_too_large');
  const manifest=PilotEvidenceSchema.parse(JSON.parse(await readFile(location,'utf8')));
  const ids=new Set<string>(),valid=new Set<string>(),issues:{code:string;target:string}[]=[];
  const add=(code:string,target:string)=>issues.push({code,target});
  for(const file of manifest.files){
    if(ids.has(file.id)){add('duplicate_file_id',file.id);valid.delete(file.id);continue;}
    ids.add(file.id);
    try{
      if(isAbsolute(file.path))throw new Error('outside');
      const target=await realpath(resolve(base,file.path)),fragment=relative(base,target);
      if(isAbsolute(fragment)||fragment==='..'||fragment.startsWith(`..${sep}`)||fragment==='')throw new Error('outside');
      const before=await stat(target);if(!before.isFile())throw new Error('not_file');
      const actual=await fileHash(target),after=await stat(target);
      if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||actual.sha256!==file.sha256||actual.bytes!==file.bytes){add('file_integrity_mismatch',file.id);continue;}
      valid.add(file.id);
    }catch{add('file_unavailable_or_outside_package',file.id);}
  }
  const duplicateIds=new Set(manifest.files.filter((file,index)=>manifest.files.findIndex(other=>other.id===file.id)!==index).map(file=>file.id));
  for(const duplicate of duplicateIds)valid.delete(duplicate);
  const refs=(values:string[],target:string)=>{
    if(!values.length){add('evidence_missing',target);return false;}
    const missing=values.filter(value=>!valid.has(value));for(const value of missing)add('evidence_unavailable',`${target}:${value}`);
    return missing.length===0;
  };
  for(const role of ['article','bible','reference','voice','render','srt','vtt','manifest'] as const)
    if(!manifest.files.some(file=>file.role===role&&valid.has(file.id)))add('required_file_missing',role);
  if(manifest.sample_type!=='real')add('real_sample_missing','sample_type');
  if(!manifest.production)add('production_reference_missing','production');
  if(!manifest.profile)add('profile_reference_missing','profile');
  for(const field of ['reviewer','recipe','format','currency','ceiling_minor'] as const)
    if(manifest.setup[field]===null)add('setup_missing',field);
  for(const field of ['rights_evidence','rubric_evidence','authorization_evidence'] as const)refs(manifest.setup[field],field);
  for(const operation of ['audio','image','animation','avatar'] as const){
    const routes=manifest.routes.filter(route=>route.operation===operation);
    if(!routes.length)add('route_evidence_missing',operation);
    for(const route of routes){refs(route.evidence,`route:${operation}`);if(route.confirmed_minor===null)add('billing_unresolved',operation);}
  }
  const renders=new Set(manifest.files.filter(file=>file.role==='render'&&valid.has(file.id)).map(file=>file.sha256));
  for(const criterion of pilotCriteria){
    const reviews=manifest.reviews.filter(review=>review.criterion===criterion);
    if(!reviews.length)add('human_review_missing',criterion);
    // Conflicting decisions stay pending: this offline format has no mechanism to revoke a review.
    for(const review of reviews){
      refs(review.evidence,`review:${criterion}`);
      if(!renders.has(review.render_sha256))add('review_render_mismatch',criterion);
      if(review.outcome==='fail')add('human_review_failed',criterion);
      if(review.outcome==='not_applicable')add('scope_decision_requires_confirmation',criterion);
    }
  }
  refs(manifest.calibration.report_evidence,'calibration_report');refs(manifest.calibration.decision_evidence,'calibration_decision');
  return{pilot_id:manifest.pilot_id,sample_type:manifest.sample_type,verified_files:valid.size,issues,
    inventory_complete:issues.length===0,
    product_acceptance:'requires_authorized_human_decision' as const,
    notice:'Verificação local de presença e integridade. Não autentica declarações, não habilita perfil, não autoriza gasto e não executa geração.'};
}

export async function createPilotPackage(directory:string,pilotId:string){
  const record=newPilotEvidence(pilotId),target=resolve(directory);
  // A new directory is mandatory, keeping existing pilot inputs and evidence immutable.
  await mkdir(target);
  await writeFile(resolve(target,'pilot-evidence.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  return resolve(target,'pilot-evidence.json');
}

async function main(){
  const [command,path,pilotId,...extra]=process.argv.slice(2);
  if(command==='init'&&path&&pilotId&&!extra.length){console.log(await createPilotPackage(path,pilotId));return;}
  if(command==='inspect'&&path&&!pilotId){const result=await inspectPilot(path);console.log(JSON.stringify(result,null,2));process.exitCode=result.inventory_complete?0:2;return;}
  throw new Error('Uso: node --import tsx tools/pilot-evidence.ts init <pasta-nova> <pilot-id> | inspect <pilot-evidence.json>');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
  main().catch(()=>{console.error('Falha ao processar pacote de evidências. Confira argumentos, formato, permissões e a documentação do piloto. Nenhuma geração foi iniciada.');process.exitCode=2;});
