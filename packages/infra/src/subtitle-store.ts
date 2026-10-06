import {createHash,randomUUID} from 'node:crypto';
import {AssetSchema,EvaluationSchema,TimelineSchema,type AssetStore,type Timeline,type Asset,type Evaluation} from '@fbr/contracts';
import {canonical,sha256} from '@fbr/domain';
import {timelineSubtitles} from '@fbr/pipeline';

/** Derivados determinísticos da timeline, sem declaração de aceite humano. */
export async function storeTimelineSubtitles(store:AssetStore,raw:Timeline){
  const timeline=TimelineSchema.parse(raw);
  if(timeline.status!=='rendered')throw new Error('subtitle_rendered_timeline_required');
  const assets:Asset[]=[],evaluations:Evaluation[]=[];
  if(!timeline.subtitles.length)return {assets,evaluations};
  for(const format of ['srt','vtt'] as const){
    const bytes=new TextEncoder().encode(timelineSubtitles(timeline,format));
    const hash=createHash('sha256').update(bytes).digest('hex'),storage_key=`subtitles/${hash}.${format}`;
    await store.putImmutable(storage_key,bytes,hash);
    const id=randomUUID(),evaluationId=randomUUID(),at=new Date().toISOString();
    assets.push(AssetSchema.parse({id,version:1,created_at:at,author:'local_subtitles',changes:[],
      status:'approved',type:'subtitle',file:{storage_key,hash,mime_type:format==='vtt'?'text/vtt':'application/x-subrip',bytes:bytes.length,
        width:null,height:null,duration_seconds:timeline.duration_seconds},origin:'rendered',execution:null,
      specification:{id:timeline.id,version:timeline.version},references:[],configuration_hash:sha256(canonical(timeline)),
      usage:{permission:'allowed',evidence:'Texto e timecodes da timeline vinculada ao render.'},evaluation_refs:[{id:evaluationId,version:1}]}));
    evaluations.push(EvaluationSchema.parse({id:evaluationId,version:1,created_at:at,author:'local_subtitles',changes:[],status:'approved',
      target:{id,version:1},method:'deterministic',criteria:[{name:'Derivação fiel da timeline',mandatory:true,result:'pass',
        evidence:`Serialização ${format} com intervalos medidos não sobrepostos; SHA-256 ${hash}. Não constitui aceite editorial humano.`,
        timecode_seconds:null,corrective_action:null}]}));
  }
  return {assets,evaluations};
}
