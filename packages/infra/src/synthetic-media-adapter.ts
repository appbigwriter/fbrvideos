import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {AdapterRequestSchema,AdapterCapabilitiesSchema,AdapterResultSchema,JobSchema,type GenerationAdapter,type AdapterRequest,type GenerationExecution,type AssetStore} from '@fbr/contracts';
import {canonical,sha256} from '@fbr/domain';
import type {SqlDatabase} from './configuration-store.js';
export interface PipelineOutput{id:string;bytes:Uint8Array;usage:{permission:'unknown'|'allowed'|'denied';evidence:string|null}}
export interface PipelineOutputResolver{resolve(execution:GenerationExecution):Promise<PipelineOutput[]>}
const run=promisify(execFile);
const mediaSpec=z.object({width:z.int().min(16).max(1920),height:z.int().min(16).max(1920),duration_seconds:z.number().positive().max(120)});
/** Ensaio recuperável, sem TTS, fornecedor externo ou evidência de qualidade editorial. */
export class SyntheticMediaAdapter implements GenerationAdapter,PipelineOutputResolver{
  readonly id:string;
  constructor(private readonly db:SqlDatabase,private readonly files:AssetStore,private readonly operation:'audio'|'image'|'animation'|'avatar'){this.id=`sim_media_${operation}`;}
  async capabilities(){return AdapterCapabilitiesSchema.parse({adapter_id:this.id,mode:'simulated',version:'1',operations:[this.operation],
    routes:this.operation==='audio'?[]:this.operation==='image'?['still_image']:this.operation==='avatar'?['avatar']:['animated_scene'],accepts_official_audio:this.operation==='avatar',
    produces_audio:this.operation==='audio',accepts_references:true,accepts_composition:true,can_query_job:true,can_cancel_job:false,max_clip_seconds:120,
    supported_fields:['text','prompt','voice_reference','_fbr'],evidence_refs:[],supports_idempotent_recovery:true});}
  async submit(raw:AdapterRequest){
    const request=AdapterRequestSchema.parse(raw);
    if(request.operation!==this.operation||request.reserved_minor!==0)throw new Error('synthetic_operation_or_cost_invalid');
    const key=`synthetic_${sha256(`${this.id}:${request.execution_key}:${request.attempt}`)}`,fingerprint=sha256(canonical(request));
    const existing=(await this.db.query('SELECT fingerprint,record FROM synthetic_generation_results WHERE external_id=$1',[key])).rows[0];
    if(existing){if(existing.fingerprint!==fingerprint)throw new Error('synthetic_intent_conflict');return AdapterResultSchema.parse({outcome:'accepted',job:(existing.record as {job:unknown}).job});}
    const spec=mediaSpec.parse(request.parameters['_fbr']),root=await mkdtemp(join(tmpdir(),'fbr-synthetic-'));
    try{
      const extension=this.operation==='audio'?'wav':this.operation==='image'?'png':'mp4',path=join(root,`output.${extension}`);
      const args=this.operation==='audio'?['-f','lavfi','-i',`sine=frequency=440:sample_rate=48000:duration=${spec.duration_seconds}`,'-c:a','pcm_s16le']
        :this.operation==='image'?['-f','lavfi','-i',`color=c=0x296587:s=${spec.width}x${spec.height}`,'-frames:v','1']
        :['-f','lavfi','-i',`color=c=0x296587:s=${spec.width}x${spec.height}:r=30:d=${spec.duration_seconds}`,'-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart'];
      await run('ffmpeg',['-hide_banner','-loglevel','error','-nostdin',...args,path],{windowsHide:true,timeout:180000,maxBuffer:1000000});
      const bytes=await readFile(path),hash=createHash('sha256').update(bytes).digest('hex'),storage_key=`synthetic/${hash}.${extension}`,assetId=`output_${sha256(key).slice(0,40)}`;
      await this.files.putImmutable(storage_key,bytes,hash);
      const at=new Date().toISOString(),job=JobSchema.parse({id:key,version:1,created_at:at,author:'synthetic_media',changes:[],status:'succeeded',production:request.production,stage:this.operation,
        provider:'local_synthetic',model:`synthetic_${this.operation}`,external_job_id:key,execution_key:request.execution_key,attempt:request.attempt,inputs:request.input_assets,
        configuration_hash:request.configuration_hash,sent_parameters:request.parameters,unsupported_fields:[],output_assets:[{id:assetId,version:1}],
        costs:{currency:request.currency,estimated_minor:0,committed_minor:0,confirmed_minor:0},error:null});
      await this.db.query('INSERT INTO synthetic_generation_results(external_id,production_id,fingerprint,record) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING',[key,request.production.id,fingerprint,JSON.stringify({job,outputs:[{id:assetId,storage_key,hash,bytes:bytes.length}]})]);
      return this.query(key);
    }finally{await rm(root,{recursive:true,force:true});}
  }
  async query(key:string){const row=(await this.db.query('SELECT record FROM synthetic_generation_results WHERE external_id=$1',[key])).rows[0];
    if(!row)throw new Error('synthetic_receipt_missing');return AdapterResultSchema.parse({outcome:'accepted',job:(row.record as {job:unknown}).job});}
  cancel(key:string){return this.query(key);}
  recover(request:AdapterRequest){return this.submit(request);}
  async resolve(execution:GenerationExecution){
    const external=execution.provider_job?.external_job_id;
    if(execution.state!=='succeeded'||!external)throw new Error('synthetic_output_not_ready');
    const row=(await this.db.query('SELECT record FROM synthetic_generation_results WHERE external_id=$1 AND production_id=$2',[external,execution.intent.request.production.id])).rows[0];
    const parsed=z.object({outputs:z.array(z.object({id:z.string(),storage_key:z.string(),hash:z.string(),bytes:z.int()}))}).parse(row?.record),outputs:PipelineOutput[]=[];
    for(const output of parsed.outputs){const bytes=await this.files.read(output.storage_key);
      if(bytes.length!==output.bytes||createHash('sha256').update(bytes).digest('hex')!==output.hash)throw new Error('synthetic_output_corrupt');
      outputs.push({id:output.id,bytes,usage:{permission:'allowed',evidence:'Mídia sintética local de ensaio; não representa voz, avatar ou piloto real.'}});}
    return outputs;
  }
}
