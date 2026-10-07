import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AssetSchema, TimelineSchema, DossierSchema, type AssetStore, type Asset, type Timeline, type Dossier } from '@fbr/contracts';
import { sameRef } from '@fbr/domain';
import {audioSpecificationMatches} from '@fbr/pipeline';
import { probeLocalMedia } from './media-probe.js';

const run = promisify(execFile);
export interface RenderExecutables { ffmpeg: string; ffprobe: string }
export async function renderLocalPreview(rawDossier: Dossier, rawTimeline: Timeline, store: AssetStore,
  tools: RenderExecutables = { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' },previousDossiers:Dossier[]=[]): Promise<Asset> {
  const dossier = DossierSchema.parse(rawDossier), timeline = TimelineSchema.parse(rawTimeline), delivery = timeline.delivery;
  if (timeline.status !== 'ready' || !sameRef(timeline.production, dossier.production) || dossier.pending_issues.some(i => i.required))
    throw new Error('render_timeline_not_ready');
  if (delivery.video_codec !== 'h264' || delivery.audio_codec !== 'aac' || delivery.width % 2 || delivery.height % 2
    || timeline.music.length>10 || timeline.audio.length + timeline.video.length+timeline.music.length > 100
    ||timeline.music.some(segment=>segment.gain_db < -60||segment.gain_db>0))
    throw new Error('render_profile_unsupported');
  const transitions=new Map<number,number>();
  for(const transition of timeline.transitions){
    const right=timeline.video.findIndex(segment=>segment.start_seconds===transition.at_seconds);
    if(right<1||transitions.has(right)||!['cut','fade'].includes(transition.type)
      ||(transition.type==='cut'&&transition.duration_seconds!==0)||(transition.type==='fade'&&(transition.duration_seconds<=0||transition.duration_seconds>1
        ||transition.duration_seconds>timeline.video[right-1]!.end_seconds-timeline.video[right-1]!.start_seconds
        ||transition.duration_seconds>timeline.video[right]!.end_seconds-timeline.video[right]!.start_seconds)))throw new Error('render_transition_unsupported');
    transitions.set(right,transition.type==='fade'?transition.duration_seconds:0);
  }
  for (const segments of [timeline.audio, timeline.video]) {
    let position = 0;
    for (const segment of segments) {
      if (Math.abs(segment.start_seconds - position) > 1 / delivery.audio_sample_rate
        || Math.abs((segment.source_out_seconds - segment.source_in_seconds) - (segment.end_seconds - segment.start_seconds)) > 1 / delivery.audio_sample_rate)
        throw new Error('render_segment_gap_or_stretch');
      position = segment.end_seconds;
    }
    if (Math.abs(position - timeline.duration_seconds) > 1 / delivery.audio_sample_rate) throw new Error('render_coverage_incomplete');
  }
  if (timeline.video.some(segment => segment.clip_audio !== 'muted')) throw new Error('render_duplicate_audio_not_allowed');
  const directory = await mkdtemp(join(tmpdir(), 'fbr-render-'));
  try {
    const args: string[] = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y'], filters: string[] = [], refs: Asset[] = [];
    const segments = [...timeline.video, ...timeline.audio,...timeline.music.map(segment=>({...segment,source_in_seconds:0,source_out_seconds:segment.end_seconds-segment.start_seconds}))];
    for (const [index, segment] of segments.entries()) {
      const asset = dossier.assets.find(asset => sameRef(asset, segment.asset));
      if (!asset || asset.status !== 'approved' || asset.usage.permission !== 'allowed'
        || !asset.evaluation_refs.some(ref => dossier.evaluations.some(e => sameRef(e, ref) && sameRef(e.target, asset) && e.status === 'approved' && e.method !== 'model_signal')))
        throw new Error('render_asset_unapproved');
      const visual = index < timeline.video.length;
      const music=index>=timeline.video.length+timeline.audio.length;
      if (visual ? !['image', 'clip'].includes(asset.type) : asset.type !== 'audio') throw new Error('render_asset_type_mismatch');
      if (asset.type !== 'image' && (asset.file.duration_seconds === null || segment.source_out_seconds > asset.file.duration_seconds))
        throw new Error('render_source_trim_invalid');
      if (visual) {
        const shot = timeline.video[index]!.shot;
        if (!dossier.shots.some(value => sameRef(value, shot)) || !sameRef(asset.specification, shot)) throw new Error('render_shot_mismatch');
      } else if (!music&&!audioSpecificationMatches(asset,dossier,previousDossiers)) throw new Error('render_audio_dossier_mismatch');
      if (!await store.exists(asset)) throw new Error('render_asset_missing_or_corrupt');
      const bytes = await store.read(asset.file.storage_key);
      // Verificar os bytes efetivamente copiados elimina divergência entre exists/read.
      if (bytes.length !== asset.file.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.file.hash) throw new Error('render_asset_hash_mismatch');
      const measured = await probeLocalMedia(bytes, asset.type as 'image' | 'audio' | 'clip', tools);
      if (measured.mime_type !== asset.file.mime_type || measured.width !== asset.file.width || measured.height !== asset.file.height
        || (asset.type !== 'image' && (measured.duration_seconds === null || asset.file.duration_seconds === null
          || Math.abs(measured.duration_seconds - asset.file.duration_seconds) > (asset.type === 'audio' ? 0.001 : 1 / delivery.fps))))
        throw new Error('render_input_measurement_mismatch');
      const extensions:Record<string,string>={'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','audio/wav':'.wav','audio/mpeg':'.mp3','audio/mp4':'.m4a','video/mp4':'.mp4'};
      const extension=extensions[asset.file.mime_type];
      if(!extension||(asset.type==='image'?!asset.file.mime_type.startsWith('image/'):asset.type==='audio'?!asset.file.mime_type.startsWith('audio/'):asset.file.mime_type!=='video/mp4'))throw new Error('render_input_mime_unsupported');
      const path = join(directory, `input-${index}${extension}`);
      await writeFile(path, bytes, { flag: 'wx' });
      const duration = segment.end_seconds - segment.start_seconds;
      if (asset.type === 'image') args.push('-loop', '1', '-framerate', String(delivery.fps), '-t', String(duration));
      args.push('-protocol_whitelist', 'file,pipe');
      if (asset.file.mime_type === 'video/mp4' || asset.file.mime_type === 'audio/mp4') args.push('-enable_drefs', '0', '-use_absolute_path', '0');
      args.push('-i', path);
      if (visual) {
        const frames = Math.round(segment.end_seconds * delivery.fps) - Math.round(segment.start_seconds * delivery.fps);
        if (frames < 1) throw new Error('render_shot_shorter_than_frame');
        const fadeIn=transitions.get(index)??0,fadeOut=transitions.get(index+1)??0;
        if(fadeIn+fadeOut>duration)throw new Error('render_transition_overlap');
        const fades=`${fadeIn?`,fade=t=in:st=0:d=${fadeIn}`:''}${fadeOut?`,fade=t=out:st=${duration-fadeOut}:d=${fadeOut}`:''}`;
        filters.push(`[${index}:v]trim=start=${segment.source_in_seconds}:end=${segment.source_out_seconds},setpts=PTS-STARTPTS,scale=${delivery.width}:${delivery.height}:force_original_aspect_ratio=decrease,pad=${delivery.width}:${delivery.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${delivery.fps},trim=end_frame=${frames},format=yuv420p${fades}[v${index}]`);
      }
      else {const mix=music?timeline.music[index-timeline.video.length-timeline.audio.length]!:null;
        const suffix=mix?`,volume=${mix.gain_db}dB,adelay=${Math.round(mix.start_seconds*delivery.audio_sample_rate)}S:all=1,apad,atrim=duration=${timeline.duration_seconds}`:'';
        filters.push(`[${index}:a]atrim=start=${segment.source_in_seconds}:end=${segment.source_out_seconds},asetpts=PTS-STARTPTS,aresample=${delivery.audio_sample_rate},aformat=sample_fmts=fltp:channel_layouts=stereo${suffix}[a${index}]`);}
      if (!refs.some(value => sameRef(value, asset))) refs.push(asset);
    }
    filters.push(`${timeline.video.map((_segment, i) => `[v${i}]`).join('')}concat=n=${timeline.video.length}:v=1:a=0[vout]`);
    filters.push(`${timeline.audio.map((_segment, i) => `[a${i + timeline.video.length}]`).join('')}concat=n=${timeline.audio.length}:v=0:a=1[${timeline.music.length?'narration':'aout'}]`);
    if(timeline.music.length)filters.push(`[narration]${timeline.music.map((_segment,i)=>`[a${i+timeline.video.length+timeline.audio.length}]`).join('')}amix=inputs=${timeline.music.length+1}:duration=first:normalize=0,alimiter=limit=0.95:level=false:latency=true[aout]`);
    const output = join(directory, 'preview.mp4');
    args.push('-filter_complex', filters.join(';'), '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast',
      '-c:a', 'aac', '-ar', String(delivery.audio_sample_rate), '-t', String(timeline.duration_seconds), '-movflags', '+faststart', output);
    await run(tools.ffmpeg, args, { windowsHide: true, timeout: 120000, maxBuffer: 1_000_000 });
    const result = await run(tools.ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', output], { windowsHide: true, timeout: 10000, maxBuffer: 1_000_000 });
    const probe = JSON.parse(result.stdout) as { streams: { codec_type: string; codec_name: string; width?: number; height?: number; sample_rate?: string; duration?: string }[]; format: { duration: string } };
    const video = probe.streams.filter(stream => stream.codec_type === 'video'), audio = probe.streams.filter(stream => stream.codec_type === 'audio');
    const duration = Number(probe.format.duration), tolerance = 1 / delivery.fps + 0.05;
    if (video.length !== 1 || audio.length !== 1 || video[0]!.codec_name !== 'h264' || audio[0]!.codec_name !== 'aac'
      || video[0]!.width !== delivery.width || video[0]!.height !== delivery.height || Number(audio[0]!.sample_rate) !== delivery.audio_sample_rate
      || !Number.isFinite(duration) || Math.abs(duration - timeline.duration_seconds) > tolerance
      || Math.abs(Number(audio[0]!.duration) - timeline.duration_seconds) > tolerance)
      throw new Error('render_output_verification_failed');
    const bytes = await readFile(output), hash = createHash('sha256').update(bytes).digest('hex'), storageKey = `renders/${hash}.mp4`;
    await store.putImmutable(storageKey, bytes, hash);
    const now = new Date().toISOString();
    return AssetSchema.parse({ id: randomUUID(), version: 1, created_at: now, author: 'local_renderer', changes: [{ at: now, author: 'local_renderer', reason: 'Preview local FFmpeg; requer avaliação audiovisual.' }],
      status: 'candidate', type: 'render', file: { storage_key: storageKey, hash, mime_type: 'video/mp4', bytes: bytes.length,
        width: delivery.width, height: delivery.height, duration_seconds: duration }, origin: 'rendered', execution: null,
      specification: { id: timeline.id, version: timeline.version }, references: refs.map(asset => ({ id: asset.id, version: asset.version })),
      configuration_hash: createHash('sha256').update(JSON.stringify(timeline)).digest('hex'), usage: { permission: 'allowed', evidence: 'Derivado de inputs com direito de uso registrado no dossiê.' }, evaluation_refs: [] });
  } finally {
    if (!directory.startsWith(join(tmpdir(), 'fbr-render-'))) throw new Error('render_cleanup_path_invalid');
    await rm(directory, { recursive: true, force: true });
  }
}
