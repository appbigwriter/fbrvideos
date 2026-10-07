import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {ProductionSchema,ProductionSnapshotSchema,DossierSchema,AssetSchema,EvaluationSchema,GenerationIntentSchema,CorrectionSchema,CorrectionExecutionPlanSchema,
  GenerationExecutionSchema,type Production,type Dossier,type Asset,type GenerationIntent,type GenerationExecution,type GenerationAdapter,type AssetStore,type VersionRef,type ProductionSnapshot} from '@fbr/contracts';
import {ApplicationError,canonical,sha256,sameRef,correctionImpact,invalidateDossier} from '@fbr/domain';
import {belongsToExecution} from './asset-provenance.js';
import {PostgresGenerationQueue} from './generation-queue.js';
import {PostgresReviewWorkflow} from './review-workflow.js';
import {PostgresMediaStore} from './media-store.js';
import {LocalAssemblyService} from './assembly-service.js';
import {probeLocalMedia} from './media-probe.js';
import type {SqlClient,SqlDatabase} from './configuration-store.js';
import type {PipelineOutputResolver,PipelineOutput} from './synthetic-media-adapter.js';

const ref=z.object({id:z.string().min(1),version:z.int().positive()});
const stepSchema=z.object({step:z.string(),requires:z.array(z.string()),specification:ref,speech_id:z.string().optional(),previous_asset:ref.optional(),
  width:z.int().positive(),height:z.int().positive(),duration_seconds:z.number().positive()});
type Step=z.infer<typeof stepSchema>;
export interface PipelineOperationContext{production:Production;dossier:Dossier;snapshot:ProductionSnapshot;operation:GenerationIntent['request']['operation'];shot:VersionRef|null;step:Step;text:string;inputs:Asset[];attempt?:number}
export interface PipelineAdapterBinding{adapter:GenerationAdapter;outputs:PipelineOutputResolver;
  estimate(context:PipelineOperationContext):Promise<GenerationIntent['estimate']>;
  validateIntent?(intent:GenerationIntent):Promise<void>;
  parameters?(context:PipelineOperationContext):Promise<GenerationIntent['request']['parameters']>;}
export type PipelineBindings=Partial<Record<'audio'|'image'|'animation'|'avatar',PipelineAdapterBinding>>;
export async function pipelineState(client:SqlClient,id:string,lock=false){
  const head=(await client.query(`SELECT version FROM production_heads WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];
  if(!head)throw new ApplicationError('not_found','Produção não encontrada.');
  const p=ProductionSchema.parse((await client.query('SELECT record FROM production_revisions WHERE id=$1 AND version=$2',[id,head.version])).rows[0]?.record);
  if(!p.dossier)throw new ApplicationError('ineligible','Planejamento ainda indisponível.');
  const d=DossierSchema.parse((await client.query('SELECT record FROM production_dossiers WHERE id=$1 AND version=$2',[p.dossier.id,p.dossier.version])).rows[0]?.record);
  const snapshot=ProductionSnapshotSchema.parse((await client.query('SELECT record FROM production_snapshots WHERE production_id=$1',[id])).rows[0]?.record),{hash,...content}=snapshot;
  if(d.production.id!==id||snapshot.production_id!==id||hash!==sha256(canonical(content)))throw new ApplicationError('ineligible','Snapshot/dossiê inconsistente.');
  return{p,d,snapshot};
}
async function publish(client:SqlClient,p:Production,d:Dossier,patch:Partial<Production>,message:string){
  const at=new Date().toISOString(),nextD=DossierSchema.parse({...d,version:d.version+1,created_at:at,changes:[...d.changes,{at,author:'production_pipeline',reason:message}]});
  await client.query('INSERT INTO production_dossiers(id,version,record) VALUES($1,$2,$3::jsonb)',[nextD.id,nextD.version,JSON.stringify(nextD)]);
  const nextP=ProductionSchema.parse({...p,...patch,version:p.version+1,created_at:at,dossier:{id:nextD.id,version:nextD.version},changes:[...p.changes,{at,author:'production_pipeline',reason:message}]});
  await client.query('INSERT INTO production_revisions(id,version,record) VALUES($1,$2,$3::jsonb)',[p.id,nextP.version,JSON.stringify(nextP)]);
  await client.query('UPDATE production_heads SET version=$2 WHERE id=$1',[p.id,nextP.version]);
  const eventId=randomUUID();await client.query('INSERT INTO production_events(id,production_id,version,record) VALUES($1,$2,$3,$4::jsonb)',[eventId,p.id,nextP.version,JSON.stringify({id:eventId,production:{id:p.id,version:nextP.version},at,type:'generation_updated',message})]);
  return{p:nextP,d:nextD};
}
const assetType=(operation:string)=>operation==='audio'?'audio':operation==='image'?'image':'clip';
/** Compila etapas; arquivos e aprovação são persistidos antes de liberar dependentes. */
export class ProductionPipeline{
  constructor(private readonly db:SqlDatabase,private readonly files:AssetStore,private readonly bindings:PipelineBindings,private readonly queue:PostgresGenerationQueue,private readonly review:PostgresReviewWorkflow){}
  private context(p:Production,d:Dossier,snapshot:ProductionSnapshot,operation:PipelineOperationContext['operation'],label:string,shot:VersionRef|null,requires:string[],text:string,previous?:Asset):PipelineOperationContext{
    const delivery=snapshot.profile.delivery;if(!delivery)throw new ApplicationError('ineligible','Formato de entrega ausente.');
    const speeches=d.blocks.flatMap(block=>block.speeches),target=shot?d.shots.find(s=>sameRef(s,shot)):null;
    const duration=operation==='audio'?Math.max(0.4,Math.min(120,(text.split(/\s+/).length||1)/2.5))
      :target?target.speech_segment_ids.reduce((total,id)=>total+(d.assets.find(a=>a.status==='approved'&&a.type==='audio'&&a.id===this.audioForSpeech(d,id)?.id)?.file.duration_seconds??Math.max(0.4,(speeches.find(s=>s.id===id)?.text.split(/\s+/).length??1)/2.5)),0):1;
    const basis=sha256(canonical({article:d.article,profile:d.profile,character:d.character,blocks:d.blocks,shots:d.shots.map(s=>({id:s.id,version:s.version,visual:s.visual,route:s.route})),label}));
    const step:Step={step:sha256(`${p.id}:${basis}:${operation}:${label}`),requires,specification:operation==='audio'?{id:d.id,version:d.version}:shot!,
      ...(operation==='audio'?{speech_id:label}:{}),...(previous?{previous_asset:{id:previous.id,version:previous.version}}:{}),width:delivery.width,height:delivery.height,duration_seconds:duration};
    return{production:p,dossier:d,snapshot,operation,shot,step,text,inputs:d.assets.filter(a=>a.status==='approved')};
  }
  private audioForSpeech(d:Dossier,id:string){return d.assets.find(a=>a.type==='audio'&&a.status==='approved'&&a.changes.some(change=>change.reason===`pipeline_speech:${id}`));}
  private async intent(context:PipelineOperationContext):Promise<GenerationIntent>{
    const binding=this.bindings[context.operation as keyof PipelineBindings];if(!binding)throw new ApplicationError('ineligible',`Rota ${context.operation} ainda não configurada.`);
    const caps=await binding.adapter.capabilities();if(!caps.operations.includes(context.operation))throw new ApplicationError('ineligible','Capability incompatível.');
    const estimate=await binding.estimate(context);
    const parameters=binding.parameters?await binding.parameters(context):context.operation==='audio'?{text:context.text,voice_reference:context.snapshot.profile.voice?.id??'synthetic'}:{prompt:context.text};
    const route=context.operation==='audio'?null:context.operation==='image'?'still_image':context.operation==='avatar'?'avatar':'animated_scene';
    const configuration_hash=sha256(canonical({adapter:caps.adapter_id,version:caps.version,parameters,step:context.step,profile:context.dossier.profile}));
    const shot=context.shot?context.dossier.shots.find(s=>sameRef(s,context.shot!)):null;
    const inputs=context.operation==='avatar'?context.inputs.filter(a=>a.type==='audio'&&shot?.speech_segment_ids.some(id=>a.changes.some(c=>c.reason===`pipeline_speech:${id}`)))
      :context.operation==='animation'?context.inputs.filter(a=>a.type==='image'&&context.shot&&sameRef(a.specification,context.shot)):[];
    const intent=GenerationIntentSchema.parse({adapter_id:caps.adapter_id,estimate,request:{contract_version:'0.1.0',execution_key:context.step.step,attempt:context.attempt??1,production:{id:context.production.id,version:context.production.version},
      operation:context.operation,route,shot:context.shot,input_assets:inputs.map(a=>({id:a.id,version:a.version})),references:context.operation==='audio'?(context.snapshot.profile.voice?[context.snapshot.profile.voice]:[]):shot?Object.values(shot.references).flat().filter((value):value is VersionRef=>!!value):[],
      configuration_hash,parameters:{...parameters,_fbr:context.step},currency:estimate.currency,reserved_minor:estimate.upper_minor}});
    await binding.validateIntent?.(intent);return intent;
  }
  private async enqueueIntent(context:PipelineOperationContext){
    const intent=await this.intent(context),current=await pipelineState(this.db,context.production.id);
    return this.queue.enqueue({...intent,request:{...intent.request,production:{id:current.p.id,version:current.p.version}}});
  }
  async start(raw:unknown){
    const command=z.strictObject({command_id:z.string().min(1),production:ref,dossier:ref}).parse(raw);
    const replay=(await this.db.query('SELECT fingerprint,result FROM review_commands WHERE command_id=$1',[command.command_id])).rows[0];
    if(replay){if(replay.fingerprint!==sha256(canonical({action:'begin_generation',raw:command})))throw new ApplicationError('conflict','Comando reutilizado.');return ProductionSchema.parse(replay.result);}
    const {p,d,snapshot}=await pipelineState(this.db,command.production.id);
    if(!sameRef(p,command.production)||!sameRef(d,command.dossier))throw new ApplicationError('conflict','Planejamento alterado.');
    // Preflight não envia; início não libera operação sem estimativa/capability.
    for(const speech of d.blocks.flatMap(block=>block.speeches))await this.intent(this.context(p,d,snapshot,'audio',speech.id,null,[],speech.text));
    for(const shot of d.shots){if(shot.route==='existing_asset'){
      if(!d.assets.some(a=>sameRef(a.specification,shot)&&a.status==='approved'&&['image','clip'].includes(a.type)))throw new ApplicationError('ineligible','Cena exige mídia existente aprovada.');
    }else{await this.intent(this.context(p,d,snapshot,shot.route==='avatar'?'avatar':'image',shot.id,{id:shot.id,version:shot.version},[],shot.intent));
      if(shot.route==='animated_scene')await this.intent(this.context(p,d,snapshot,'animation',shot.id,{id:shot.id,version:shot.version},[],shot.intent));}}
    const started=await this.review.beginGeneration(command);await this.advance(p.id);return (await pipelineState(this.db,started.id)).p;
  }
  async canExecute(execution:GenerationExecution){
    const step=stepSchema.safeParse(execution.intent.request.parameters['_fbr']);if(!step.success)return true;
    const {p,d}=await pipelineState(this.db,execution.intent.request.production.id);
    if(!['producing','correcting'].includes(p.status))return false;
    const jobs=await this.queue.list(p.id);
    return (await Promise.all(step.data.requires.map(key=>this.approvedOutput(d,jobs,key)))).every(Boolean);
  }
  async advance(id:string){
    const token=randomUUID(),lease=await this.db.transaction(async client=>{
      await client.query('INSERT INTO pipeline_leases(production_id,token,lease_until) VALUES($1,$2,CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING',[id,token]);
      return !!(await client.query("UPDATE pipeline_leases SET token=$2,lease_until=CURRENT_TIMESTAMP+INTERVAL '15 minutes' WHERE production_id=$1 AND lease_until<=CURRENT_TIMESTAMP RETURNING production_id",[id,token])).rows.length;
    });if(!lease)return;
    const renewal=setInterval(()=>{void this.db.query("UPDATE pipeline_leases SET lease_until=CURRENT_TIMESTAMP+INTERVAL '15 minutes' WHERE production_id=$1 AND token=$2",[id,token]).catch(()=>{});},30000);renewal.unref();
    try{
      let {p,d,snapshot}=await pipelineState(this.db,id);if(!['producing','correcting'].includes(p.status))return;
      const jobs=await this.queue.list(id);
      for(const execution of jobs)if(execution.provider_job?.status==='succeeded'&&stepSchema.safeParse(execution.intent.request.parameters['_fbr']).success)await this.ingest(execution,token);
      ({p,d,snapshot}=await pipelineState(this.db,id));
      if(p.stage==='assembly'){await this.assemble(p,d);return;}
      if(p.status==='correcting'){await this.finishCorrection(p,d);return;}
      const all=await this.queue.list(id);
      for(const speech of d.blocks.flatMap(block=>block.speeches)){
        const context=this.context(p,d,snapshot,'audio',speech.id,null,[],speech.text);
        if(!all.some(job=>job.intent.request.execution_key===context.step.step))await this.enqueueIntent(context);
      }
      const speechJobs=await this.queue.list(id);
      for(const shot of d.shots){
        if(shot.route==='existing_asset')continue;
        const shotRef={id:shot.id,version:shot.version},audioKeys=shot.speech_segment_ids.map(speechId=>this.context(p,d,snapshot,'audio',speechId,null,[],d.blocks.flatMap(b=>b.speeches).find(s=>s.id===speechId)!.text).step.step);
        const initialOp=shot.route==='avatar'?'avatar':'image',initial=this.context(p,d,snapshot,initialOp,shot.id,shotRef,shot.route==='avatar'?audioKeys:[],shot.intent);
        if(!speechJobs.some(job=>job.intent.request.execution_key===initial.step.step)&&(await Promise.all(initial.step.requires.map(key=>this.approvedOutput(d,speechJobs,key)))).every(Boolean))await this.enqueueIntent(initial);
        if(shot.route==='animated_scene'){
          const animation=this.context(p,d,snapshot,'animation',shot.id,shotRef,[initial.step.step,...audioKeys],shot.intent);
          const current=await this.queue.list(id);
          if(!current.some(job=>job.intent.request.execution_key===animation.step.step)&&(await Promise.all(animation.step.requires.map(key=>this.approvedOutput(d,current,key)))).every(Boolean))await this.enqueueIntent(animation);
        }
      }
      if(d.blocks.flatMap(b=>b.speeches).every(s=>this.audioForSpeech(d,s.id))&&d.shots.every(shot=>this.visualForShot(d,shot))){
        const current=await this.queue.list(id);
        if(current.some(job=>!['succeeded','failed','cancelled'].includes(job.state))||p.costs.committed_minor)return;
        const state=await this.db.transaction(async client=>{await this.ensureLease(client,id,token);const state=await pipelineState(client,id,true);return publish(client,state.p,state.d,{stage:'assembly'},'Inputs avaliados; montagem automática liberada.');});
        await this.assemble(state.p,state.d);
      }
    }finally{clearInterval(renewal);await this.db.query('UPDATE pipeline_leases SET lease_until=CURRENT_TIMESTAMP WHERE production_id=$1 AND token=$2',[id,token]);}
  }
  private async approvedOutput(d:Dossier,jobs:GenerationExecution[],key:string,client:SqlClient=this.db){
    const job=jobs.filter(j=>j.intent.request.execution_key===key).sort((a,b)=>b.intent.request.attempt-a.intent.request.attempt)[0];
    if(job?.state!=='succeeded'||!job.provider_job)return false;
    for(const asset of d.assets.filter(a=>a.status==='approved'&&a.usage.permission==='allowed'))if(await belongsToExecution(client,d.production.id,asset,job))return true;
    return false;
  }
  private visualForShot(d:Dossier,shot:Dossier['shots'][number]){return d.assets.find(a=>a.status==='approved'&&sameRef(a.specification,shot)&&(shot.route==='avatar'||shot.route==='animated_scene'?a.type==='clip':['image','clip'].includes(a.type)));}
  private async ensureLease(client:SqlClient,id:string,token:string){if(!(await client.query('SELECT production_id FROM pipeline_leases WHERE production_id=$1 AND token=$2 AND lease_until>CURRENT_TIMESTAMP FOR UPDATE',[id,token])).rows.length)throw new ApplicationError('conflict','Avanço perdeu a posse da execução.');}
  private async ingest(execution:GenerationExecution,token:string){
    const job=execution.provider_job!,step=stepSchema.parse(execution.intent.request.parameters['_fbr']),binding=this.bindings[execution.intent.request.operation as keyof PipelineBindings];if(!binding)return;
    const {d}=await pipelineState(this.db,execution.intent.request.production.id);
    const already=(await this.db.query("SELECT id FROM media_heads WHERE kind='asset' AND production_id=$1 AND id=ANY($2::text[])",[execution.intent.request.production.id,job.output_assets.map(ref=>ref.id)])).rows;
    if(job.output_assets.length&&already.length===job.output_assets.length){
      if(d.jobs.some(old=>old.id===job.id&&old.version<job.version))await this.db.transaction(async client=>{await this.ensureLease(client,execution.intent.request.production.id,token);const state=await pipelineState(client,execution.intent.request.production.id,true);
        if(state.d.jobs.some(old=>old.id===job.id&&old.version<job.version))await publish(client,state.p,{...state.d,jobs:state.d.jobs.map(old=>old.id===job.id?job:old)}, {},'Recibo/cobrança do job reconciliados; proveniência original da mídia preservada.');});
      return;
    }
    const outputs=await binding.outputs.resolve(execution);
    if(!outputs.length||outputs.length!==job.output_assets.length||outputs.some(output=>!job.output_assets.some(ref=>ref.id===output.id&&ref.version===1)))throw new Error('pipeline_outputs_mismatch');
    const measured:{output:PipelineOutput;type:'audio'|'image'|'clip';probe:Awaited<ReturnType<typeof probeLocalMedia>>;hash:string;storage_key:string}[]=[];
    for(const output of outputs){const type=assetType(execution.intent.request.operation),probe=await probeLocalMedia(output.bytes,type),hash=createHash('sha256').update(output.bytes).digest('hex'),storage_key=`media/${hash}.bin`;
      await this.files.putImmutable(storage_key,output.bytes,hash);measured.push({output,type,probe,hash,storage_key});}
    await this.db.transaction(async client=>{
      await this.ensureLease(client,execution.intent.request.production.id,token);
      const {p,d}=await pipelineState(client,execution.intent.request.production.id,true);
      if(!['producing','correcting'].includes(p.status)||d.assets.some(a=>job.output_assets.some(ref=>ref.id===a.id)))return;
      const dependencies:VersionRef[]=[...execution.intent.request.input_assets];
      const persisted=(await client.query('SELECT r.record FROM generation_revisions r JOIN generation_heads h USING(id,version) WHERE h.production_id=$1',[p.id])).rows.map(row=>GenerationExecutionSchema.parse(row.record));
      for(const key of step.requires){const dependency=persisted.filter(j=>j.intent.request.execution_key===key).sort((a,b)=>b.intent.request.attempt-a.intent.request.attempt)[0];
        if(!dependency||!await this.approvedOutput(d,persisted,key,client))throw new ApplicationError('ineligible','Input da publicação ainda não avaliado.');
        for(const input of d.assets.filter(a=>a.status==='approved'))if(await belongsToExecution(client,p.id,input,dependency)&&!dependencies.some(ref=>sameRef(ref,input)))dependencies.push({id:input.id,version:input.version});}
      const at=new Date().toISOString(),assets=measured.map(({output,type,probe,hash,storage_key})=>AssetSchema.parse({id:output.id,version:1,created_at:at,author:'production_pipeline',changes:[{at,author:'production_pipeline',reason:step.speech_id?`pipeline_speech:${step.speech_id}`:`pipeline_step:${step.step}`}],
        status:'candidate',type,file:{storage_key,hash,bytes:output.bytes.length,...probe},origin:execution.intent.adapter_id.startsWith('sim_')?'fixture':'provider',execution:{id:job.id,version:job.version},
        specification:type==='audio'?{id:d.id,version:d.version+1}:step.specification,references:dependencies,configuration_hash:execution.intent.request.configuration_hash,usage:output.usage,evaluation_refs:[]}));
      await new PostgresMediaStore(this.db,this.files).commitWithin(client,p.id,assets.map(record=>({kind:'asset',record,expected_version:null})));
      await publish(client,p,{...d,assets:[...d.assets,...assets],jobs:[...d.jobs.filter(j=>j.id!==job.id),job]}, {},'Outputs copiados e medidos; avaliação pendente.');
    });
  }
  async candidates(id:string){const {p,d}=await pipelineState(this.db,id);return{production:{id:p.id,version:p.version},dossier:{id:d.id,version:d.version},items:d.assets.filter(a=>['audio','image','clip'].includes(a.type)&&a.status!=='outdated').map(a=>({...a,preview_url:`/api/productions/${encodeURIComponent(id)}/candidates/${encodeURIComponent(a.id)}?version=${a.version}`}))};}
  async retry(raw:unknown){
    const request=z.strictObject({command_id:z.string().min(1),production:ref,asset:ref,reason:z.string().trim().min(1).max(3000)}).parse(raw),fingerprint=sha256(canonical(request));
    const oldCommand=(await this.db.query('SELECT fingerprint,result FROM pipeline_commands WHERE command_id=$1',[request.command_id])).rows[0];
    if(oldCommand){if(oldCommand.fingerprint!==fingerprint)throw new ApplicationError('conflict','Comando reutilizado.');return ProductionSchema.parse(oldCommand.result);}
    const {p,d,snapshot}=await pipelineState(this.db,request.production.id),asset=d.assets.find(a=>sameRef(a,request.asset)&&a.status==='rejected');
    if(!sameRef(p,request.production)||!asset||!['producing','correcting'].includes(p.status))throw new ApplicationError('ineligible','Nova tentativa exige candidato rejeitado da produção atual.');
    const executions=await this.queue.list(p.id),previous=executions.find(e=>e.provider_job?.id===asset.execution?.id);
    if(!previous||!await belongsToExecution(this.db,p.id,asset,previous))throw new ApplicationError('ineligible','Proveniência da alternativa indisponível.');
    const attempt=Math.max(...executions.filter(e=>e.intent.request.execution_key===previous.intent.request.execution_key).map(e=>e.intent.request.attempt))+1;
    if(attempt>(snapshot.profile.budget?.max_attempts_per_job??1))throw new ApplicationError('attempts_exceeded','Limite de alternativas atingido; revisar a direção e o orçamento.');
    const step=stepSchema.parse(previous.intent.request.parameters['_fbr']),context:PipelineOperationContext={production:p,dossier:d,snapshot,operation:previous.intent.request.operation,shot:previous.intent.request.shot,step,text:String(previous.intent.request.parameters['text']??previous.intent.request.parameters['prompt']??''),inputs:d.assets.filter(a=>a.status==='approved'),attempt};
    const intent=await this.intent(context);
    return this.db.transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',[request.command_id]);const replay=(await client.query('SELECT fingerprint,result FROM pipeline_commands WHERE command_id=$1',[request.command_id])).rows[0];
      if(replay){if(replay.fingerprint!==fingerprint)throw new ApplicationError('conflict','Comando reutilizado.');return ProductionSchema.parse(replay.result);}
      const current=await pipelineState(client,p.id,true);if(!sameRef(current.p,request.production))throw new ApplicationError('conflict','Produção alterada antes de reservar alternativa.');
      await this.queue.enqueueBatchWithin(client,[intent]);
      const updated=await pipelineState(client,p.id);await client.query('INSERT INTO pipeline_commands(command_id,production_id,fingerprint,result) VALUES($1,$2,$3,$4::jsonb)',[request.command_id,p.id,fingerprint,JSON.stringify(updated.p)]);return updated.p;
    });
  }
  async candidateFile(id:string,assetRef:VersionRef){const {d}=await pipelineState(this.db,id),asset=d.assets.find(a=>sameRef(a,assetRef)&&['audio','image','clip'].includes(a.type));
    if(!asset||!await this.files.exists(asset))throw new ApplicationError('not_found','Mídia candidata indisponível.');
    const bytes=await this.files.read(asset.file.storage_key);return{bytes,mime_type:asset.file.mime_type,hash:asset.file.hash};}
  async evaluate(raw:unknown){
    const request=z.strictObject({command_id:z.string().min(1),production:ref,asset:ref,hash:z.string().regex(/^[a-f0-9]{64}$/),decision:z.enum(['approved','rejected']),reviewed_in_full:z.literal(true),rights_confirmed:z.boolean(),reason:z.string().trim().min(1).max(3000)}).parse(raw),fingerprint=sha256(canonical(request));
    const result=await this.db.transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',[request.command_id]);
      const existing=(await client.query('SELECT fingerprint,result FROM pipeline_commands WHERE command_id=$1',[request.command_id])).rows[0];
      if(existing){if(existing.fingerprint!==fingerprint)throw new ApplicationError('conflict','Comando reutilizado com outra intenção.');return ProductionSchema.parse(existing.result);}
      const {p,d}=await pipelineState(client,request.production.id,true);if(!sameRef(p,request.production)||!['producing','correcting'].includes(p.status))throw new ApplicationError('conflict','Produção mudou ou não aceita avaliação.');
      const old=d.assets.find(a=>sameRef(a,request.asset));
      if(!old||old.status!=='candidate'||old.file.hash!==request.hash||!await this.files.exists(old))throw new ApplicationError('ineligible','Avaliação exige candidato atual íntegro.');
      if(request.decision==='approved'&&!request.rights_confirmed)throw new ApplicationError('ineligible','Aprovação exige direitos confirmados.');
      const at=new Date().toISOString(),evaluation=EvaluationSchema.parse({id:randomUUID(),version:1,created_at:at,author:'local_operator',changes:[],target:{id:old.id,version:old.version+1},method:'human',status:request.decision,
        criteria:[{name:'Revisão integral da mídia e uso autorizado',mandatory:true,result:request.decision==='approved'?'pass':'fail',evidence:request.reason,timecode_seconds:null,corrective_action:request.decision==='rejected'?'Gerar alternativa dentro dos limites.':null}]}),
        next=AssetSchema.parse({...old,version:old.version+1,created_at:at,status:request.decision,usage:request.rights_confirmed?{permission:'allowed',evidence:request.reason}:old.usage,evaluation_refs:[...old.evaluation_refs,{id:evaluation.id,version:1}]});
      await new PostgresMediaStore(this.db,this.files).commitWithin(client,p.id,[{kind:'asset',record:next,expected_version:old.version},{kind:'evaluation',record:evaluation,expected_version:null}]);
      const state=await publish(client,p,{...d,assets:d.assets.map(a=>a.id===next.id?next:a),evaluations:[...d.evaluations,evaluation]}, {},'Avaliação humana da mídia exata registrada.');
      await client.query('INSERT INTO pipeline_commands(command_id,production_id,fingerprint,result) VALUES($1,$2,$3,$4::jsonb)',[request.command_id,p.id,fingerprint,JSON.stringify(state.p)]);return state.p;
    });await this.advance(result.id);return result;
  }
  private async assemble(p:Production,d:Dossier){
    const service=new LocalAssemblyService(this.db,this.files);await service.reconcileInterrupted();
    const runs=(await this.db.query('SELECT state,command_id FROM assembly_runs WHERE production_id=$1 AND production_version=$2 ORDER BY started_at',[p.id,p.version])).rows;
    if(runs.some(run=>run.state==='running'))return;
    const audio=d.blocks.flatMap(b=>b.speeches).map(s=>{const a=this.audioForSpeech(d,s.id);if(!a)throw new Error('pipeline_audio_binding_missing');return{speech_segment_id:s.id,asset:{id:a.id,version:a.version}};}),
      video=d.shots.map(shot=>{const a=this.visualForShot(d,shot);if(!a)throw new Error('pipeline_visual_binding_missing');return{shot:{id:shot.id,version:shot.version},asset:{id:a.id,version:a.version}};});
    await service.assemble({command_id:`assemble_${sha256(`${p.id}:${p.version}:${runs.length}`)}`,production:{id:p.id,version:p.version},bindings:{audio,video}});
  }
  async prepareCorrection(id:string){
    const {p,d,snapshot}=await pipelineState(this.db,id),rows=(await this.db.query('SELECT r.record FROM correction_proposal_revisions r JOIN correction_proposal_heads h USING(id,version) WHERE h.production_id=$1',[id])).rows;
    for(const row of rows){const correction=CorrectionSchema.parse(row.record);if(correction.status!=='proposed')continue;
      const visual=['image_mismatch','identity','environment','motion'].includes(correction.category),root=visual?d.timeline?.video.find(s=>correction.shot&&sameRef(s.shot,correction.shot))?.asset:{id:d.id,version:d.version};
      if(!root)throw new ApplicationError('ineligible','Raiz de correção indisponível.');
      const impact=correctionImpact(d,[root]),affected=d.assets.filter(a=>(d.status==='outdated'?a.status==='outdated':impact.invalidated.some(ref=>ref.id===a.id))&&['audio','image','clip'].includes(a.type));
      const predicted=d.status==='outdated'?d:invalidateDossier(d,[root]);
      const intents:GenerationIntent[]=[];
      for(const old of [...affected].sort((a,b)=>({audio:0,image:1,clip:2}[a.type as 'audio'|'image'|'clip'])-({audio:0,image:1,clip:2}[b.type as 'audio'|'image'|'clip']))){
        const speechId=old.changes.find(c=>c.reason.startsWith('pipeline_speech:'))?.reason.slice('pipeline_speech:'.length),shot=predicted.shots.find(s=>s.id===old.specification.id);
        const operation=old.type==='audio'?'audio':old.type==='image'?'image':shot?.route==='avatar'?'avatar':'animation';
        const label=speechId??shot?.id;if(!label)throw new ApplicationError('ineligible','Input sem vínculo para recompilar correção.');
        const text=speechId?d.blocks.flatMap(b=>b.speeches).find(s=>s.id===speechId)!.text:shot!.intent;
        const dependencies=operation==='avatar'||operation==='animation'?intents.filter(intent=>intent.request.operation==='audio'||operation==='animation'&&intent.request.operation==='image'&&intent.request.shot?.id===shot?.id).map(intent=>intent.request.execution_key):[];
        const context=this.context(p,predicted,snapshot,operation,label,shot?{id:shot.id,version:shot.version}:null,dependencies,text,old);
        context.step.step=sha256(`${context.step.step}:correction:${correction.id}`);
        intents.push(await this.intent(context));
      }
      const body={id:`plan_${sha256(`${correction.id}:${d.version}`)}`,correction:{id:correction.id,version:correction.version},production:{id:p.id,version:p.version},dossier:{id:d.id,version:d.version},roots:[root],intents};
      await this.review.estimateCorrection({...body,hash:sha256(canonical(body))});
    }
  }
  private async finishCorrection(p:Production,d:Dossier){
    const rows=(await this.db.query('SELECT r.record FROM correction_proposal_revisions r JOIN correction_proposal_heads h USING(id,version) WHERE h.production_id=$1',[p.id])).rows;
    for(const row of rows){const correction=CorrectionSchema.parse(row.record);if(correction.status!=='running')continue;
      const plans=(await this.db.query('SELECT record FROM correction_execution_plans WHERE correction_id=$1',[correction.id])).rows.map(row=>CorrectionExecutionPlanSchema.parse(row.record));
      const replacements=[];
      for(const intent of plans.flatMap(plan=>plan.intents)){
        const step=stepSchema.parse(intent.request.parameters['_fbr']);if(!step.previous_asset)continue;
        const execution=(await this.queue.list(p.id)).filter(e=>e.intent.request.execution_key===intent.request.execution_key).sort((a,b)=>b.intent.request.attempt-a.intent.request.attempt)[0];
        if(execution?.state!=='succeeded')return;
        const output=d.assets.find(a=>a.status==='approved'&&execution.provider_job?.output_assets.some(ref=>ref.id===a.id));
        const previous=d.assets.find(a=>a.id===step.previous_asset!.id&&a.status==='outdated');if(!output||!previous)return;
        replacements.push({previous:{id:previous.id,version:previous.version},next:{id:output.id,version:output.version}});
      }
      if(!replacements.length)return;
      const next=await this.review.publishCorrectionAssets({command_id:`publish_${sha256(`${correction.id}:${d.version}`)}`,production:{id:p.id,version:p.version},correction:{id:correction.id,version:correction.version},replacements});
      await this.assemble(next,(await pipelineState(this.db,p.id)).d);
    }
  }
  async recover(){
    await new LocalAssemblyService(this.db,this.files).reconcileInterrupted();
    const rows=(await this.db.query("SELECT h.id FROM production_heads h JOIN production_revisions r USING(id,version) WHERE r.record->>'status' IN ('producing','correcting') ORDER BY h.id LIMIT 100")).rows;
    const errors=[];for(const row of rows)try{await this.advance(String(row.id));}catch{errors.push(String(row.id));}return{checked:rows.length,pending:errors.length};
  }
}
