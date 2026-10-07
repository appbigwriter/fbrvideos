import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { dossierFixture, fixtureDelivery, fixtureRefs } from '@fbr/contracts/fixtures';
import { assembleTimeline } from '@fbr/pipeline';
import { LocalImmutableAssetStore } from '../src/asset-store.js';
import { renderLocalPreview } from '../src/local-renderer.js';
import { probeLocalMedia } from '../src/media-probe.js';
import { inspectAudioMix } from '../src/media-quality.js';
const run = promisify(execFile);
test('Probe mede PNG/JPEG/WebP/WAV/MP3/MP4 e render aceita JPEG/MP3 sem duração inventada', async t => {
  try { await run('ffmpeg', ['-version'], { windowsHide: true }); await run('ffprobe', ['-version'], { windowsHide: true }); }
  catch { t.skip('FFmpeg não disponível'); return; }
  const root = await mkdtemp(join(tmpdir(), 'fbr-probe-test-'));
  const ffmpeg = async (args: string[]) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', ...args], { windowsHide: true });
  try {
    for (const extension of ['png', 'jpg', 'webp']) {
      const path = join(root, `image.${extension}`);
      await ffmpeg(['-f', 'lavfi', '-i', 'color=c=green:s=160x240', '-frames:v', '1', path]);
      const probe = await probeLocalMedia(await readFile(path), 'image');
      assert.equal(probe.width, 160); assert.equal(probe.height, 240); assert.equal(probe.duration_seconds, null);
      assert.equal(probe.mime_type, extension === 'jpg' ? 'image/jpeg' : `image/${extension}`);
    }
    for (const extension of ['wav', 'mp3']) {
      const path = join(root, `audio.${extension}`);
      await ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=4', '-c:a', extension === 'wav' ? 'pcm_s16le' : 'libmp3lame', path]);
      const probe = await probeLocalMedia(await readFile(path), 'audio');
      assert.ok(Math.abs(probe.duration_seconds! - 4) <= 1 / 48000);
      if (extension === 'mp3') { const container = await run('ffprobe', ['-v', 'error', '-show_format', '-of', 'json', path], { windowsHide: true });
        assert.ok(Math.abs(Number(JSON.parse(container.stdout).format.duration) - probe.duration_seconds!) < 0.1); }
    }
    const clip = join(root, 'clip.mp4'); await ffmpeg(['-f', 'lavfi', '-i', 'color=c=red:s=160x240:r=30:d=4', '-f', 'lavfi', '-i', 'sine=sample_rate=48000:duration=4', '-c:v', 'libx264', '-c:a', 'aac', clip]);
    const probe = await probeLocalMedia(await readFile(clip), 'clip'); assert.equal(probe.width, 160); assert.ok(Math.abs(probe.duration_seconds! - 4) < 0.04);
    const dossier = structuredClone(dossierFixture), store = new LocalImmutableAssetStore(join(root, 'store'));
    for (const [type, path] of [['image', join(root, 'image.jpg')], ['audio', join(root, 'audio.mp3')]] as const) {
      const bytes = await readFile(path), metadata = await probeLocalMedia(bytes, type), hash = createHash('sha256').update(bytes).digest('hex');
      const asset = dossier.assets.find(asset => asset.type === type)!;
      asset.file = { storage_key: `inputs/${hash}.bin`, bytes: bytes.length, hash, ...metadata };
      await store.putImmutable(asset.file.storage_key, bytes, hash);
    }
    const timeline = assembleTimeline(dossier, { ...fixtureDelivery, width: 160, height: 240 }, { audio: [{ speech_segment_id: 'speech_01', asset: fixtureRefs.audio }], video: [{ shot: fixtureRefs.shot, asset: fixtureRefs.image }] });
    const render = await renderLocalPreview(dossier, timeline, store); assert.equal(render.status, 'candidate');
    const mix = await inspectAudioMix(await store.read(render.file.storage_key), { target_lufs: -16, tolerance_lu: 20, max_true_peak_dbtp: -1 });
    assert.equal(mix.audio_hash, render.file.hash); assert.equal(mix.status, 'passed'); assert.ok(mix.integrated_lufs !== null && mix.true_peak_dbtp !== null);
    const narrow = await inspectAudioMix(await readFile(join(root, 'audio.wav')), { target_lufs: -16, tolerance_lu: 0.1, max_true_peak_dbtp: -1 });
    assert.equal(narrow.status, 'failed'); assert.ok(narrow.issues.includes('audio_loudness_outside_policy'));
    const peak = await inspectAudioMix(await readFile(join(root, 'audio.wav')), { target_lufs: -16, tolerance_lu: 20, max_true_peak_dbtp: -20 });
    assert.equal(peak.status, 'failed'); assert.ok(peak.issues.includes('audio_true_peak_exceeds_policy'));
    const silence = join(root, 'silence.wav'); await ffmpeg(['-f', 'lavfi', '-i', 'anullsrc=r=48000', '-t', '4', silence]);
    assert.equal((await inspectAudioMix(await readFile(silence), { target_lufs: -16, tolerance_lu: 1, max_true_peak_dbtp: -1 })).status, 'unknown');
    await assert.rejects(probeLocalMedia(await readFile(join(root, 'image.png')), 'audio'), /audio_streams/);
    await assert.rejects(probeLocalMedia(Buffer.from('#EXTM3U\nhttps://example.com/video'), 'clip'), /signature/);
    await assert.rejects(probeLocalMedia(Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]), 'image'));
  } finally { assert.ok(root.startsWith(join(tmpdir(), 'fbr-probe-test-'))); await rm(root, { recursive: true, force: true }); }
});
