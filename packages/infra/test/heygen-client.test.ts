import test from 'node:test';
import assert from 'node:assert/strict';
import {getPipelineCatalog} from '@fbr/pipeline';
import {sha256} from '@fbr/domain';
import {HeygenClient} from '../src/index.js';
test('HeyGen REST conserva seleção da voz e exige áudio externo no avatar, sem retry de envio ambíguo',async()=>{
  const calls:{url:string;body:unknown}[]=[],catalog=getPipelineCatalog(),voice=catalog.models.find(model=>model.id==='heygen_official_voice')!,avatar=catalog.models.find(model=>model.id==='heygen_audio_avatar')!;
  const client=new HeygenClient(()=> 'fixture-key-not-secret',async(url,init)=>{
    const body=init?.body?JSON.parse(String(init.body)):null;calls.push({url:String(url),body});
    const data=String(url).endsWith('/voices/speech')?{request_id:'speech_fixture',audio_url:'https://files.example/audio.mp3',duration:0.4,engine:'orca'}
      :String(url).endsWith('/videos')?{video_id:'video_fixture',status:'waiting',output_format:'mp4'}:{id:'video_fixture',status:'completed',video_url:'https://files.example/video.mp4',duration:0.4};
    return new Response(JSON.stringify({data}),{headers:{'Content-Type':'application/json'}});
  });
  const base={contract_version:'0.1.0' as const,execution_key:sha256('heygen-test'),attempt:1,production:{id:'p',version:1},shot:null,operation:'audio' as const,route:null,
    input_assets:[],references:[{id:'official_voice',version:1}],configuration_hash:sha256('config'),parameters:{text:'Texto sintético.',voice_id:'voice_fixture'},currency:'BRL',reserved_minor:100};
  const speech=await client.synthesizeSpeech(voice,base);assert.equal(speech.engine,'orca');assert.equal((calls[0]!.body as {engine?:string}).engine,undefined);
  const visual={...base,shot:{id:'shot',version:1},operation:'avatar' as const,route:'avatar' as const,input_assets:[{id:'measured_audio',version:1}],parameters:{type:'avatar',avatar_id:'look_fixture',audio_url:speech.audio_url}};
  assert.equal((await client.generateAvatar(avatar,visual)).video_id,'video_fixture');assert.equal((await client.videoStatus('video_fixture')).status,'completed');
  await assert.rejects(client.generateAvatar(avatar,{...visual,parameters:{...visual.parameters,script:'Não substituir áudio oficial.'}}),/request_invalid/);
  await assert.rejects(client.synthesizeSpeech(voice,{...base,parameters:{...base.parameters,speed:3}}),/request_invalid/);
  let sends=0;const ambiguous=new HeygenClient(()=> 'fixture-key-not-secret',async()=>{sends++;throw new Error('lost response');});
  await assert.rejects(ambiguous.synthesizeSpeech(voice,base));assert.equal(sends,1);
});
