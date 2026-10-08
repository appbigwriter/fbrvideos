import test from 'node:test';
import assert from 'node:assert/strict';
import { dossierFixture, timelineFixture } from '@fbr/contracts/fixtures';
import { TimelineSchema } from '@fbr/contracts';
import { alignedSubtitleCues, layoutSubtitleText } from '../src/subtitle-alignment.js';
import { timelineSubtitles } from '../src/assembly.js';
const audio = dossierFixture.assets.find(asset => asset.type === 'audio')!;
const layout = { max_characters_per_line: 10, max_lines: 1, max_characters_per_second: 15,
  safe_area: { left: 0.1, top: 0.75, right: 0.9, bottom: 0.95 } };
const alignment = { audio_hash: audio.file.hash, source: 'fixture observed timings', words: [
  { text: 'Primeira', start_seconds: 0, end_seconds: 1 }, { text: 'fala.', start_seconds: 1, end_seconds: 2 },
  { text: 'Outra', start_seconds: 2.5, end_seconds: 3 }, { text: 'fala.', start_seconds: 3, end_seconds: 4 }] };
test('Legendas segmentam timings observados e mantêm pausas sem inventar palavras', () => {
  const cues = alignedSubtitleCues('Primeira fala. Outra fala.', audio, alignment, 5, 'speech', layout);
  assert.deepEqual(cues.map(cue => [cue.text, cue.start_seconds, cue.end_seconds]), [
    ['Primeira', 5, 6], ['fala.', 6, 7], ['Outra', 7.5, 8], ['fala.', 8, 9]]);
});
test('Quebras por layout persistem em SRT/VTT e VTT posiciona cue dentro da área horizontal reservada', () => {
  const multiline = { ...layout, max_lines: 2 };
  const cues = alignedSubtitleCues('Primeira fala. Outra fala.', audio, alignment, 0, 'speech', multiline);
  assert.deepEqual(cues.map(cue => cue.text), ['Primeira\nfala.', 'Outra\nfala.']);
  const timeline = TimelineSchema.parse({ ...timelineFixture, subtitles: cues, subtitle_layout: multiline });
  assert.deepEqual(timeline.subtitle_layout, multiline);
  assert.match(timelineSubtitles(timeline, 'srt'), /00:00:00,000 --> 00:00:02,000\nPrimeira\nfala\./u);
  assert.match(timelineSubtitles(timeline, 'vtt'), /00:00:00.000 --> 00:00:02.000 line:95%,end position:50%,center size:80% align:center\nPrimeira\nfala\./u);
  assert.equal(layoutSubtitleText('Primeira fala.', multiline), 'Primeira\nfala.');
  assert.throws(() => layoutSubtitleText('Primeira fala. Outra fala.', multiline), /observed_alignment_required/);
  assert.throws(() => TimelineSchema.parse({ ...timeline, subtitles: [{ ...cues[0]!, text: 'Linha enorme acima do limite' }] }));
  assert.throws(() => TimelineSchema.parse({ ...timeline, subtitles: [{ ...cues[0]!, text: 'a\nb\nc' }] }));
  assert.throws(() => TimelineSchema.parse({ ...timeline, subtitle_layout: { ...multiline, safe_area: { left: 0.5, top: 0.2, right: 0.4, bottom: 0.8 } } }));
  assert.ok(!('subtitle_layout' in TimelineSchema.parse(timelineFixture)), 'Registros antigos não ganham defaults que mudariam hashes.');
});
test('Legendas recusam hash/texto divergente, sobreposição, fala cortada e leitura rápida', () => {
  assert.throws(() => alignedSubtitleCues('Primeira fala. Outra fala.', audio, { ...alignment, audio_hash: '0'.repeat(64) }, 0, 'speech', layout), /provenance/);
  assert.throws(() => alignedSubtitleCues('Texto editado.', audio, alignment, 0, 'speech', layout), /text_mismatch/);
  const overlap = structuredClone(alignment); overlap.words[1]!.start_seconds = 0.5;
  assert.throws(() => alignedSubtitleCues('Primeira fala. Outra fala.', audio, overlap, 0, 'speech', layout), /interval/);
  const truncated = structuredClone(alignment); truncated.words.at(-1)!.end_seconds = 99;
  assert.throws(() => alignedSubtitleCues('Primeira fala. Outra fala.', audio, truncated, 0, 'speech', layout), /interval/);
  assert.throws(() => alignedSubtitleCues('Primeira fala. Outra fala.', audio, alignment, 0, 'speech', { ...layout, max_characters_per_second: 1 }), /reading_speed/);
});
