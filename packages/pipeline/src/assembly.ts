import { randomUUID } from 'node:crypto';
import { DossierSchema, DeliveryProfileSchema, TimelineSchema, type Dossier, type Timeline,
  type Asset, type VersionRef, type DeliveryProfile } from '@fbr/contracts';
import { sameRef,canonical } from '@fbr/domain';

export interface AssemblyBindings {
  audio: { speech_segment_id: string; asset: VersionRef }[];
  video: { shot: VersionRef; asset: VersionRef }[];
  music?:Timeline['music'];
  transitions?:Timeline['transitions'];
}
function approvedAsset(dossier: Dossier, ref: VersionRef, types: Asset['type'][]) {
  const asset = dossier.assets.find(asset => sameRef(asset, ref));
  if (!asset || asset.status !== 'approved' || !types.includes(asset.type) || asset.usage.permission !== 'allowed'
    || !asset.evaluation_refs.some(ref => dossier.evaluations.some(e => sameRef(e, ref) && sameRef(e.target, asset)
      && e.status === 'approved' && e.method !== 'model_signal')))
    throw new Error('assembly_asset_not_approved');
  return asset;
}
export function audioSpecificationMatches(asset:Asset,dossier:Dossier,previousDossiers:Dossier[]=[]){
  if(sameRef(asset.specification,dossier))return true;
  const original=previousDossiers.map(d=>DossierSchema.parse(d)).find(d=>sameRef(d,asset.specification));
  return !!original&&original.id===dossier.id&&original.production.id===dossier.production.id&&sameRef(original.article,dossier.article)
    &&sameRef(original.profile,dossier.profile)&&sameRef(original.character,dossier.character)
    &&canonical(original.blocks)===canonical(dossier.blocks)&&canonical(original.editorial_sources)===canonical(dossier.editorial_sources)
    &&original.assets.some(a=>a.id===asset.id&&a.version<=asset.version&&canonical(a.file)===canonical(asset.file)
      &&sameRef(a.specification,asset.specification)&&canonical(a.execution)===canonical(asset.execution)
      &&canonical(a.references)===canonical(asset.references)&&a.configuration_hash===asset.configuration_hash&&a.type===asset.type);
}
/** Duração vem dos áudios medidos; nenhum timecode é derivado da duração-alvo. */
export function assembleTimeline(raw: Dossier, rawDelivery: DeliveryProfile, bindings: AssemblyBindings,previousDossiers:Dossier[]=[]): Timeline {
  const dossier = DossierSchema.parse(raw), delivery = DeliveryProfileSchema.parse(rawDelivery);
  if (dossier.pending_issues.some(issue => issue.required)) throw new Error('assembly_required_issue_pending');
  const blocks = [...dossier.blocks].sort((a, b) => a.sequence - b.sequence);
  if (new Set(blocks.map(block => block.sequence)).size !== blocks.length) throw new Error('assembly_block_sequence_duplicate');
  const speeches = blocks.flatMap(block => block.speeches);
  if (new Set(speeches.map(speech => speech.id)).size !== speeches.length) throw new Error('assembly_speech_duplicate');
  if (bindings.audio.length !== speeches.length || new Set(bindings.audio.map(binding => binding.speech_segment_id)).size !== speeches.length)
    throw new Error('assembly_audio_binding_mismatch');
  const audio: Timeline['audio'] = [], subtitles: Timeline['subtitles'] = [];
  let totalSamples = 0;
  for (const speech of speeches) {
    const binding = bindings.audio.find(binding => binding.speech_segment_id === speech.id);
    if (!binding) throw new Error('assembly_audio_missing');
    const asset = approvedAsset(dossier, binding.asset, ['audio']);
    if(!audioSpecificationMatches(asset,dossier,previousDossiers))throw new Error('assembly_audio_dossier_mismatch');
    if (!asset.file.duration_seconds) throw new Error('assembly_audio_duration_missing');
    const samples = Math.round(asset.file.duration_seconds * delivery.audio_sample_rate);
    if (samples < 1) throw new Error('assembly_audio_duration_invalid');
    const start = totalSamples / delivery.audio_sample_rate;
    totalSamples += samples;
    const end = totalSamples / delivery.audio_sample_rate;
    audio.push({ start_seconds: start, end_seconds: end, speech_segment_id: speech.id, asset: binding.asset,
      source_in_seconds: 0, source_out_seconds: samples / delivery.audio_sample_rate });
    if (speech.mode !== 'pause') subtitles.push({ start_seconds: start, end_seconds: end, speech_segment_id: speech.id, text: speech.text });
  }
  if (bindings.video.length !== dossier.shots.length || new Set(bindings.video.map(binding => `${binding.shot.id}:${binding.shot.version}`)).size !== dossier.shots.length)
    throw new Error('assembly_video_binding_mismatch');
  const covered = new Set<string>(), video: Timeline['video'] = [];
  for (const shot of dossier.shots) {
    const binding = bindings.video.find(binding => sameRef(binding.shot, shot));
    if (!binding) throw new Error('assembly_video_missing');
    const asset = approvedAsset(dossier, binding.asset, ['image', 'clip']);
    if (!sameRef(asset.specification, shot)) throw new Error('assembly_visual_shot_mismatch');
    const ranges = shot.speech_segment_ids.map(id => {
      if (covered.has(id)) throw new Error('assembly_speech_covered_twice');
      covered.add(id);
      const segment = audio.find(segment => segment.speech_segment_id === id);
      if (!segment) throw new Error('assembly_shot_speech_missing');
      return segment;
    }).sort((a, b) => a.start_seconds - b.start_seconds);
    if (!ranges.length || ranges.some((segment, i) => i > 0 && segment.start_seconds !== ranges[i - 1]!.end_seconds))
      throw new Error('assembly_shot_speech_non_contiguous');
    const start = ranges[0]!.start_seconds, end = ranges.at(-1)!.end_seconds;
    if (asset.type === 'clip' && (asset.file.duration_seconds === null || asset.file.duration_seconds < end - start))
      throw new Error('assembly_clip_too_short');
    video.push({ start_seconds: start, end_seconds: end, shot: binding.shot, asset: binding.asset,
      source_in_seconds: 0, source_out_seconds: end - start, clip_audio: 'muted' });
  }
  if (covered.size !== speeches.length) throw new Error('assembly_uncovered_speech');
  video.sort((a, b) => a.start_seconds - b.start_seconds);
  const now = new Date().toISOString();
  for(const segment of bindings.music??[]){const asset=approvedAsset(dossier,segment.asset,['audio']);
    if(asset.file.duration_seconds===null||asset.file.duration_seconds<segment.end_seconds-segment.start_seconds)throw new Error('assembly_music_too_short');}
  return TimelineSchema.parse({ id: randomUUID(), version: 1, created_at: now, author: 'local_assembler',
    changes: [{ at: now, author: 'local_assembler', reason: 'Montagem pelo áudio medido, com clips sem áudio duplicado.' }],
    status: 'ready', production: dossier.production, duration_seconds: totalSamples / delivery.audio_sample_rate,
    delivery, audio, video, subtitles, music: bindings.music??[], transitions: bindings.transitions??[] });
}
export function timelineSubtitles(raw: Timeline, format: 'srt' | 'vtt') {
  const timeline = TimelineSchema.parse(raw);
  function timestamp(seconds: number) {
    const milliseconds = Math.round(seconds * 1000);
    const hour = Math.floor(milliseconds / 3600000), minute = Math.floor(milliseconds / 60000) % 60, second = Math.floor(milliseconds / 1000) % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}${format === 'srt' ? ',' : '.'}${String(milliseconds % 1000).padStart(3, '0')}`;
  }
  const cues = [...timeline.subtitles].sort((a, b) => a.start_seconds - b.start_seconds);
  const lines = cues.map((cue, i) => {
    if (Math.round(cue.end_seconds * 1000) <= Math.round(cue.start_seconds * 1000)
      || (i > 0 && cue.start_seconds < cues[i - 1]!.end_seconds)) throw new Error('assembly_subtitle_interval_invalid');
    const text = cue.text.replace(/\s+/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `${i + 1}\n${timestamp(cue.start_seconds)} --> ${timestamp(cue.end_seconds)}\n${text}\n`;
  });
  return `${format === 'vtt' ? 'WEBVTT\n\n' : ''}${lines.join('\n')}`;
}
