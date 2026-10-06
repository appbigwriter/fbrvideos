import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {z} from 'zod';
const run=promisify(execFile);
function container(bytes:Uint8Array){
  const data=Buffer.from(bytes),text=(start:number,end:number)=>data.subarray(start,end).toString('ascii');
  if(data.length<12)throw new Error('media_signature_unsupported');
  if(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {mime:'image/png',extension:'png',format:'image2'};
  if(data[0]===255&&data[1]===216&&data[2]===255)return {mime:'image/jpeg',extension:'jpg',format:'image2'};
  if(text(0,4)==='RIFF'&&text(8,12)==='WEBP')return {mime:'image/webp',extension:'webp',format:'image2'};
  if(text(0,4)==='RIFF'&&text(8,12)==='WAVE')return {mime:'audio/wav',extension:'wav',format:'wav'};
  if(text(0,3)==='ID3'||(data[0]===255&&(data[1]!&224)===224))return {mime:'audio/mpeg',extension:'mp3',format:'mp3'};
  if(text(4,8)==='ftyp')return {mime:'video/mp4',extension:'mp4',format:'mov'};
  throw new Error('media_signature_unsupported');
}
async function decodedSamples(executable:string,args:string[]){
  return new Promise<number>((resolve,reject)=>{
    const child=spawn(executable,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let bytes=0,finished=false;
    const timer=setTimeout(()=>{child.kill();},120000);timer.unref();
    child.stdout.on('data',(part:Buffer)=>{bytes+=part.length;if(!Number.isSafeInteger(bytes))child.kill();});
    child.stderr.on('data',()=>{});
    child.once('error',()=>{if(finished)return;finished=true;clearTimeout(timer);reject(new Error('media_decode_failed'));});
    child.once('close',code=>{if(finished)return;finished=true;clearTimeout(timer);
      if(code!==0||bytes===0||bytes%2)reject(new Error('media_decode_failed'));else resolve(bytes/2);});
  });
}
/** Assinatura/container restritos; duração vocal vem dos samples decodificados, sem confiar no header do provedor. */
export async function probeLocalMedia(bytes:Uint8Array,type:'image'|'audio'|'clip',tools={ffmpeg:'ffmpeg',ffprobe:'ffprobe'}){
  if(!bytes.length||bytes.length>100_000_000)throw new Error('media_probe_size_invalid');
  const detected=container(bytes),root=await mkdtemp(join(tmpdir(),'fbr-probe-')),path=join(root,`input.${detected.extension}`);
  const input=['-protocol_whitelist','file,pipe','-f',detected.format,...(detected.format==='mov'?['-enable_drefs','0','-use_absolute_path','0']:[])];
  try{
    await writeFile(path,bytes,{flag:'wx'});
    const result=await run(tools.ffprobe,['-v','error',...input,'-show_streams','-show_format','-of','json',path],{windowsHide:true,timeout:15000,maxBuffer:1_000_000});
    const probe=z.object({streams:z.array(z.object({codec_type:z.string(),width:z.number().optional(),height:z.number().optional(),sample_rate:z.string().optional(),duration:z.string().optional()})),
      format:z.object({duration:z.string().optional()})}).parse(JSON.parse(result.stdout));
    const audio=probe.streams.filter(stream=>stream.codec_type==='audio'),video=probe.streams.filter(stream=>stream.codec_type==='video');
    if(type==='audio'){
      if(audio.length!==1||video.length||detected.mime.startsWith('image/'))throw new Error('media_audio_streams_invalid');
      const rate=z.coerce.number().int().min(8000).max(384000).parse(audio[0]!.sample_rate);
      const samples=await decodedSamples(tools.ffmpeg,['-hide_banner','-loglevel','error','-nostdin',...input,'-i',path,'-map','0:a:0','-ac','1','-ar',String(rate),'-c:a','pcm_s16le','-f','s16le','pipe:1']);
      return {mime_type:detected.format==='mov'?'audio/mp4':detected.mime,width:null,height:null,duration_seconds:samples/rate};
    }
    if(video.length!==1||type==='image'&&(!detected.mime.startsWith('image/')||audio.length)||type==='clip'&&detected.format!=='mov')throw new Error('media_visual_streams_invalid');
    const width=z.int().min(1).max(8192).parse(video[0]!.width),height=z.int().min(1).max(8192).parse(video[0]!.height);
    const duration=type==='clip'?z.coerce.number().positive().finite().parse(video[0]!.duration??probe.format.duration):null;
    return {mime_type:detected.mime,width,height,duration_seconds:duration};
  }finally{if(!root.startsWith(join(tmpdir(),'fbr-probe-')))throw new Error('media_probe_cleanup_invalid');await rm(root,{recursive:true,force:true});}
}
