import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const run = promisify(execFile);
export interface AudioMixPolicy { target_lufs: number; tolerance_lu: number; max_true_peak_dbtp: number }
export interface AudioMixEvidence {
  audio_hash: string; method: 'ffmpeg_loudnorm_ebu_r128'; integrated_lufs: number | null;
  true_peak_dbtp: number | null; loudness_range_lu: number | null;
  status: 'passed' | 'failed' | 'unknown'; issues: string[];
}
/** Measurement is deterministic evidence, never a human audiovisual/lip-sync acceptance. */
export async function inspectAudioMix(bytes: Uint8Array, policy: AudioMixPolicy,
  executable = 'ffmpeg'): Promise<AudioMixEvidence> {
  if (!bytes.length || bytes.length > 100_000_000 || !Number.isFinite(policy.target_lufs) || policy.target_lufs < -70 || policy.target_lufs > -5
    || !Number.isFinite(policy.tolerance_lu) || policy.tolerance_lu < 0 || policy.tolerance_lu > 20
    || !Number.isFinite(policy.max_true_peak_dbtp) || policy.max_true_peak_dbtp > 0 || policy.max_true_peak_dbtp < -20)
    throw new Error('audio_mix_policy_invalid');
  const root = await mkdtemp(join(tmpdir(), 'fbr-mix-'));
  try {
    const path = join(root, 'input.bin'); await writeFile(path, bytes, { flag: 'wx' });
    const result = await run(executable, ['-hide_banner', '-nostdin', '-protocol_whitelist', 'file,pipe', '-i', path,
      '-map', '0:a:0', '-vn', '-af', 'loudnorm=I=-16:TP=-1:LRA=11:print_format=json',
      '-f', 'null', '-'], { windowsHide: true, timeout: 120000, maxBuffer: 1_000_000 });
    const match = result.stderr.match(/\{\s*"input_i"[\s\S]*?\}/u); if (!match) throw new Error('audio_mix_measurement_missing');
    const data = JSON.parse(match[0]) as Record<string, unknown>;
    const metric = (key: string) => { const value = typeof data[key] === 'string' ? Number(data[key]) : NaN; return Number.isFinite(value) ? value : null; };
    const integrated = metric('input_i'), peak = metric('input_tp'), range = metric('input_lra'), issues: string[] = [];
    if (integrated === null || peak === null || range === null) issues.push('audio_mix_measurement_unknown');
    if (integrated !== null && Math.abs(integrated - policy.target_lufs) > policy.tolerance_lu) issues.push('audio_loudness_outside_policy');
    if (peak !== null && peak > policy.max_true_peak_dbtp) issues.push('audio_true_peak_exceeds_policy');
    return { audio_hash: createHash('sha256').update(bytes).digest('hex'), method: 'ffmpeg_loudnorm_ebu_r128', integrated_lufs: integrated,
      true_peak_dbtp: peak, loudness_range_lu: range, status: issues.includes('audio_mix_measurement_unknown') ? 'unknown' : issues.length ? 'failed' : 'passed', issues };
  } finally { if (!root.startsWith(join(tmpdir(), 'fbr-mix-'))) throw new Error('audio_mix_cleanup_invalid'); await rm(root, { recursive: true, force: true }); }
}
