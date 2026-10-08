import { SubtitleLayoutSchema, type Asset, type Timeline } from '@fbr/contracts';

/** Timings must be observed by the provider/aligner, never extrapolated from word counts. */
export interface SubtitleAlignment {
  audio_hash: string;
  source: string;
  words: { text: string; start_seconds: number; end_seconds: number }[];
}
export interface SubtitleAligner {
  version:string;
  align(input: { audio: Asset; text: string; language: string }): Promise<SubtitleAlignment>;
}
export interface SubtitleLayout {
  max_characters_per_line: number;
  max_lines: number;
  max_characters_per_second: number;
  safe_area: { left: number; top: number; right: number; bottom: number };
}
const normalized = (text: string) => text.replace(/\s+/gu, ' ').trim();
export function alignedSubtitleCues(text: string, asset: Asset, alignment: SubtitleAlignment,
  offset: number, speechId: string, layout: SubtitleLayout): Timeline['subtitles'] {
  if (alignment.audio_hash !== asset.file.hash || !alignment.source.trim() || !alignment.words.length
    || asset.file.duration_seconds === null || !Number.isFinite(offset) || offset < 0)
    throw new Error('subtitle_alignment_provenance_invalid');
  if (!Number.isInteger(layout.max_characters_per_line) || layout.max_characters_per_line < 10 || layout.max_characters_per_line > 100
    || !Number.isInteger(layout.max_lines) || layout.max_lines < 1 || layout.max_lines > 3
    || !Number.isFinite(layout.max_characters_per_second) || layout.max_characters_per_second <= 0
    || Object.values(layout.safe_area).some(value => !Number.isFinite(value) || value < 0 || value > 1)
    || layout.safe_area.left >= layout.safe_area.right || layout.safe_area.top >= layout.safe_area.bottom)
    throw new Error('subtitle_layout_invalid');
  if (normalized(alignment.words.map(word => word.text).join(' ')) !== normalized(text))
    throw new Error('subtitle_alignment_text_mismatch');
  let previous = 0;
  for (const word of alignment.words) {
    if (!normalized(word.text) || !Number.isFinite(word.start_seconds) || !Number.isFinite(word.end_seconds)
      || word.start_seconds < previous || word.end_seconds <= word.start_seconds || word.end_seconds > asset.file.duration_seconds + 0.001
      || normalized(word.text).length > layout.max_characters_per_line)
      throw new Error('subtitle_alignment_interval_invalid');
    previous = word.end_seconds;
  }
  const groups: { words: typeof alignment.words; lines: string[] }[] = []; let group: typeof alignment.words = [], lines = [''];
  for (const word of alignment.words) {
    const value = normalized(word.text), current = lines.at(-1)!;
    if ((current ? `${current} ${value}` : value).length > layout.max_characters_per_line) {
      if (lines.length === layout.max_lines) { groups.push({ words: group, lines: [...lines] }); group = []; lines = ['']; }
      else lines.push('');
    }
    lines[lines.length - 1] = lines.at(-1) ? `${lines.at(-1)} ${value}` : value;
    group.push(word);
  }
  if (group.length) groups.push({ words: group, lines });
  return groups.map(({ words, lines }) => {
    const start = words[0]!.start_seconds, end = words.at(-1)!.end_seconds, value = lines.join('\n');
    if (normalized(value).length / (end - start) > layout.max_characters_per_second) throw new Error('subtitle_reading_speed_exceeded');
    return { start_seconds: offset + start, end_seconds: offset + end, speech_segment_id: speechId, text: value };
  });
}
/** Line wrapping changes presentation only. Cue boundaries continue to use measured evidence. */
export function layoutSubtitleText(text: string, rawLayout: SubtitleLayout): string {
  const layout = SubtitleLayoutSchema.parse(rawLayout), lines = [''];
  for (const word of normalized(text).split(' ')) {
    if (word.length > layout.max_characters_per_line) throw new Error('subtitle_word_exceeds_line');
    const line = lines.at(-1)!;
    if ((line ? `${line} ${word}` : word).length > layout.max_characters_per_line) {
      if (lines.length === layout.max_lines) throw new Error('subtitle_observed_alignment_required');
      lines.push(word);
    } else lines[lines.length - 1] = line ? `${line} ${word}` : word;
  }
  return lines.join('\n');
}
