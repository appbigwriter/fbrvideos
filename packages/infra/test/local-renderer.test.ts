import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dossierFixture, fixtureDelivery, fixtureRefs } from '@fbr/contracts/fixtures';
import { assembleTimeline } from '@fbr/pipeline';
import { LocalImmutableAssetStore, renderLocalPreview } from '../src/index.js';

const run = promisify(execFile);
test('FFmpeg produz preview real sintético íntegro, com uma trilha de áudio e sem aprovação fictícia', async t => {
  try { await run('ffmpeg', ['-version'], { windowsHide: true }); await run('ffprobe', ['-version'], { windowsHide: true }); }
  catch { t.skip('FFmpeg/ffprobe não disponíveis neste ambiente.'); return; }
  const root = await mkdtemp(join(tmpdir(), 'fbr-render-test-'));
  try {
    const image = join(root, 'image.png'), audio = join(root, 'audio.wav');
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-f', 'lavfi', '-i', 'color=c=blue:s=160x240', '-frames:v', '1', image], { windowsHide: true });
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=0.4', '-c:a', 'pcm_s16le', audio], { windowsHide: true });
    const dossier = structuredClone(dossierFixture), store = new LocalImmutableAssetStore(join(root, 'store'));
    for (const [type, path] of [['image', image], ['audio', audio]] as const) {
      const bytes = await readFile(path), hash = createHash('sha256').update(bytes).digest('hex'), asset = dossier.assets.find(a => a.type === type)!;
      asset.file = { ...asset.file, storage_key: `inputs/${hash}.bin`, hash, bytes: bytes.length,
        ...(type === 'image' ? { width: 160, height: 240 } : { duration_seconds: 0.4 }) };
      await store.putImmutable(asset.file.storage_key, bytes, hash);
    }
    const timeline = assembleTimeline(dossier, { ...fixtureDelivery, width: 160, height: 240 },
      { audio: [{ speech_segment_id: 'speech_01', asset: fixtureRefs.audio }], video: [{ shot: fixtureRefs.shot, asset: fixtureRefs.image }] });
    const preview = await renderLocalPreview(dossier, timeline, store);
    assert.equal(preview.status, 'candidate'); assert.equal(preview.origin, 'rendered'); assert.deepEqual(preview.evaluation_refs, []);
    assert.equal(preview.file.width, 160); assert.ok(preview.file.bytes > 1000); assert.equal(await store.exists(preview), true);
    assert.ok(Math.abs(preview.file.duration_seconds! - 0.4) < 0.09);
    const mixed={...timeline,music:[{asset:fixtureRefs.audio,gain_db:-24,start_seconds:0.1,end_seconds:0.3}]};
    const musicPreview=await renderLocalPreview(dossier,mixed,store);assert.equal(await store.exists(musicPreview),true);
    const divided={...timeline,video:[{...timeline.video[0]!,end_seconds:0.2,source_out_seconds:0.2},
      {...timeline.video[0]!,start_seconds:0.2,source_in_seconds:0.2}],transitions:[{at_seconds:0.2,type:'fade',duration_seconds:0.05}]};
    const faded=await renderLocalPreview(dossier,divided,store);assert.equal(await store.exists(faded),true);
    await assert.rejects(renderLocalPreview(dossier,{...divided,transitions:[{at_seconds:0.1,type:'fade',duration_seconds:0.05}]},store),/transition_unsupported/);
    await assert.rejects(renderLocalPreview(dossier, { ...timeline, video: timeline.video.map(v => ({ ...v, clip_audio: 'official_audio' })) }, store), /duplicate_audio/);
    const forgedDuration = structuredClone(dossier); forgedDuration.assets.find(asset => asset.type === 'audio')!.file.duration_seconds = 0.5;
    await assert.rejects(renderLocalPreview(forgedDuration, timeline, store), /input_measurement_mismatch/);
    const forgedMime = structuredClone(dossier); forgedMime.assets.find(asset => asset.type === 'image')!.file.mime_type = 'image/jpeg';
    await assert.rejects(renderLocalPreview(forgedMime, timeline, store), /input_measurement_mismatch/);
    const missing = structuredClone(dossier); missing.assets.find(a => a.type === 'audio')!.file.storage_key = 'missing.wav';
    await assert.rejects(renderLocalPreview(missing, timeline, store), /missing_or_corrupt/);
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'fbr-render-test-'))); await rm(root, { recursive: true, force: true });
  }
});
