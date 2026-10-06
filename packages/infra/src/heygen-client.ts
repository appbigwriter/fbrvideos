import {z} from 'zod';
import {AdapterRequestSchema,type AdapterRequest,type ModelOperation} from '@fbr/contracts';
import {validateModelRequest} from '@fbr/pipeline';
const speechBody=z.strictObject({text:z.string().min(1),voice_id:z.string().min(1),input_type:z.literal('text').optional(),speed:z.number().min(0.5).max(2).optional(),
  language:z.string().min(1).optional(),locale:z.string().min(1).optional(),engine:z.enum(['starfish','orca','elevenlabs','elevenlabs_v3']).optional(),force_regenerate:z.boolean().optional()});
const avatarBody=z.strictObject({type:z.literal('avatar'),avatar_id:z.string().min(1),audio_url:z.url(),
  resolution:z.enum(['720p','1080p']).optional(),aspect_ratio:z.enum(['auto','16:9','9:16','1:1']).optional()});
function publicAudioUrl(raw:string){const url=new URL(raw);if(url.protocol!=='https:'||url.username||url.password)throw new Error('heygen_audio_url_invalid');}
/** Rotas conservadoras documentadas; seleção de voz/look, preços e normalização de jobs pertencem ao runtime da conta. */
export class HeygenClient{
  constructor(private readonly key:()=>string,private readonly network:typeof fetch=fetch){}
  private async call(path:string,body?:unknown){
    const key=this.key();if(!key.trim()||/[\r\n]/.test(key))throw new Error('heygen_credential_missing');
    const response=await this.network(`https://api.heygen.com${path}`,{method:body===undefined?'GET':'POST',headers:{'X-Api-Key':key,Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},
      redirect:'error',signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!response.ok)throw new Error('heygen_http_failure');if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('heygen_response_type_invalid');
    const reader=response.body?.getReader();if(!reader)throw new Error('heygen_response_empty');const chunks:Uint8Array[]=[];let size=0;
    try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1_000_000)throw new Error('heygen_response_too_large');chunks.push(part.value);}}
    finally{await reader.cancel();}return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  }
  async synthesizeSpeech(model:ModelOperation,raw:AdapterRequest){
    const request=AdapterRequestSchema.parse(raw);if(request.operation!=='audio'||validateModelRequest(model,request).length)throw new Error('heygen_speech_request_invalid');
    const body=speechBody.parse(request.parameters),response=z.object({data:z.object({request_id:z.string().min(1),audio_url:z.url(),duration:z.number().positive(),engine:z.string().min(1),
      word_timestamps:z.array(z.strictObject({word:z.string(),start:z.number().nonnegative(),end:z.number().positive()}).refine(word=>word.end>word.start)).optional()})}).parse(await this.call('/v3/voices/speech',body));
    publicAudioUrl(response.data.audio_url);
    if(response.data.word_timestamps?.some(word=>word.end>response.data.duration))throw new Error('heygen_word_timing_invalid');
    return response.data;
  }
  async generateAvatar(model:ModelOperation,raw:AdapterRequest){
    const request=AdapterRequestSchema.parse(raw);if(request.operation!=='avatar'||validateModelRequest(model,request).length)throw new Error('heygen_avatar_request_invalid');
    const body=avatarBody.parse(request.parameters);publicAudioUrl(body.audio_url);
    return z.object({data:z.object({video_id:z.string().min(1),status:z.string().min(1),output_format:z.literal('mp4')})}).parse(await this.call('/v3/videos',body)).data;
  }
  async videoStatus(videoId:string){
    if(!videoId.trim()||videoId.length>300)throw new Error('heygen_video_id_invalid');
    const response=z.object({data:z.object({id:z.string(),status:z.string().min(1),video_url:z.url().nullable().optional(),duration:z.number().nonnegative().nullable().optional()})})
      .parse(await this.call(`/v3/videos/${encodeURIComponent(videoId)}`));
    if(response.data.id!==videoId)throw new Error('heygen_video_id_mismatch');if(response.data.video_url)publicAudioUrl(response.data.video_url);return response.data;
  }
}
