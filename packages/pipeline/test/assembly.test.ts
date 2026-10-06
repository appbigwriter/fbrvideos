import test from 'node:test';
import assert from 'node:assert/strict';
import { dossierFixture, fixtureDelivery, fixtureRefs } from '@fbr/contracts/fixtures';
import { assembleTimeline, timelineSubtitles } from '../src/assembly.js';

const bindings = { audio: [{ speech_segment_id: 'speech_01', asset: fixtureRefs.audio }], video: [{ shot: fixtureRefs.shot, asset: fixtureRefs.image }] };
test('Montagem usa áudio efetivo, imagem ocupa a fala e legendas não inventam duração', () => {
  const dossier = structuredClone(dossierFixture); dossier.assets.find(a => a.type === 'audio')!.file.duration_seconds = 3.25;
  dossier.shots[0]!.duration.target_seconds = 99;
  const timeline = assembleTimeline(dossier, fixtureDelivery, bindings);
  assert.equal(timeline.duration_seconds, 3.25); assert.equal(timeline.audio[0]!.source_out_seconds, 3.25);
  assert.equal(timeline.video[0]!.end_seconds, 3.25); assert.equal(timeline.video[0]!.clip_audio, 'muted');
  assert.match(timelineSubtitles(timeline, 'srt'), /00:00:00,000 --> 00:00:03,250/);
  assert.match(timelineSubtitles(timeline, 'vtt'), /^WEBVTT\n\n1\n00:00:00.000 --> 00:00:03.250/);
  assert.equal(timeline.status, 'ready'); assert.equal(dossier.timeline!.duration_seconds, 8);
});
test('Asset rejeitado, avaliação de outra versão, áudio sem duração e pendência bloqueiam montagem', () => {
  for (const mutate of [
    (d: typeof dossierFixture) => { d.assets.find(a => a.type === 'audio')!.status = 'rejected'; },
    (d: typeof dossierFixture) => { d.evaluations.find(e => e.id === 'evaluation_audio_fixture')!.target.version = 2; },
    (d: typeof dossierFixture) => { d.assets.find(a => a.type === 'audio')!.file.duration_seconds = null; },
    (d: typeof dossierFixture) => { d.pending_issues = [{ code: 'gate', message: 'Piloto pendente', next_action: 'Avaliar', required: true }]; },
  ]) { const dossier = structuredClone(dossierFixture); mutate(dossier); assert.throws(() => assembleTimeline(dossier, fixtureDelivery, bindings)); }
});
test('Revisão errada, falas sem cobertura ou cobertas duas vezes e clip curto são recusados', () => {
  assert.throws(() => assembleTimeline(dossierFixture, fixtureDelivery, { ...bindings, video: [{ shot: { ...fixtureRefs.shot, version: 2 }, asset: fixtureRefs.image }] }), /video_missing/);
  const doubled = structuredClone(dossierFixture); doubled.shots[0]!.speech_segment_ids.push('speech_01');
  assert.throws(() => assembleTimeline(doubled, fixtureDelivery, bindings), /covered_twice/);
  const short = structuredClone(dossierFixture); const visual = short.assets.find(a => a.type === 'image')!;
  visual.type = 'clip'; visual.file.duration_seconds = 2;
  assert.throws(() => assembleTimeline(short, fixtureDelivery, bindings), /clip_too_short/);
  const mismatch = structuredClone(dossierFixture); mismatch.assets.find(a => a.type === 'audio')!.specification.version = 2;
  assert.throws(() => assembleTimeline(mismatch, fixtureDelivery, bindings), /audio_dossier_mismatch/);
});
test('Correção visual reutiliza áudio apenas com proveniência imutável e fala/fontes/perfil intactos',()=>{
  const original=structuredClone(dossierFixture),current=structuredClone(original);current.version++;
  assert.throws(()=>assembleTimeline(current,fixtureDelivery,bindings),/audio_dossier_mismatch/);
  assert.equal(assembleTimeline(current,fixtureDelivery,bindings,[original]).duration_seconds,8);
  const approvedAgain=structuredClone(current),audio=approvedAgain.assets.find(asset=>asset.type==='audio')!;audio.version++;
  const evaluation=approvedAgain.evaluations.find(e=>e.target.id===audio.id)!;evaluation.target.version=audio.version;
  assert.equal(assembleTimeline(approvedAgain,fixtureDelivery,{...bindings,audio:[{speech_segment_id:'speech_01',asset:{id:audio.id,version:audio.version}}]},[original]).duration_seconds,8);
  audio.file.hash='f'.repeat(64);
  assert.throws(()=>assembleTimeline(approvedAgain,fixtureDelivery,{...bindings,audio:[{speech_segment_id:'speech_01',asset:{id:audio.id,version:audio.version}}]},[original]),/audio_dossier_mismatch/);
  current.blocks[0]!.speeches[0]!.text='Fala diferente';
  assert.throws(()=>assembleTimeline(current,fixtureDelivery,bindings,[original]),/audio_dossier_mismatch/);
});
