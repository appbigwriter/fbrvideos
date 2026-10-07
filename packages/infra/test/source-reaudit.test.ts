import test from 'node:test';
import assert from 'node:assert/strict';
import { ProductionSnapshotSchema, type InferenceJournal, type InferenceResult } from '@fbr/contracts';
import { articleFixture, profileFixture, dossierFixture, universeConfigurationFixture } from '@fbr/contracts/fixtures';
import { canonical, sha256 } from '@fbr/domain';
import { getPipelineCatalog } from '@fbr/pipeline';
import { SemanticSourceReauditor, type SourceReauditRequest } from '../src/source-reaudit.js';
function fixture(): SourceReauditRequest {
  const bible = '# Bible sintética: comunicação clara, sem vivências fabricadas.', article = { ...articleFixture, content_hash: sha256(articleFixture.content) },
    profile = { ...profileFixture, recipe: 'explanation' }, character = { ...universeConfigurationFixture.characters[0]!, id: profile.character.id,
      bible: { ...universeConfigurationFixture.characters[0]!.bible, original_hash: sha256(bible) } };
  const dossier = structuredClone(dossierFixture), source = { production_id: dossier.production.id, captured_at: '2026-10-06T12:00:00Z',
    request: { contract_version: '0.1.0', command_id: 'create', name: 'Ensaio source reaudit', mode: 'calibration', article: dossier.article, profile: dossier.profile },
    article, profile, character, bible_original: bible, references: [], catalog: getPipelineCatalog() };
  return { command_id: 'edit_fixture', production: dossier.production, dossier,
    snapshot: ProductionSnapshotSchema.parse({ ...source, hash: sha256(canonical(source)) }), speech_id: 'speech_01',
    text: 'Eu recomendo ajustar as notificações para reduzir interrupções.' };
}
const journal: InferenceJournal = { run: (_key, _fingerprint, infer) => infer() };
const pass = { result: 'pass', findings: [], source_coverage: ['source_01'] };
test('Reauditoria preserva fonte e registra sinal semântico e proveniência sem fabricar aceite', async () => {
  const request = fixture(), original = structuredClone(request); let prompt = '';
  const auditor = new SemanticSourceReauditor({ async run(value) { prompt = value; return { value: pass, usage: { input_tokens: 12, output_tokens: 20 } }; } }, journal);
  const evidence = await auditor.audit(request);
  assert.equal(evidence.status, 'passed'); assert.equal(evidence.method, 'model_signal'); assert.equal(evidence.snapshot_hash, request.snapshot.hash);
  assert.equal(evidence.edited_text_hash, sha256(request.text)); assert.deepEqual(evidence.sources, request.dossier.blocks[0]!.speeches[0]!.sources);
  assert.deepEqual(request, original); assert.match(prompt, /não é aceite editorial/u); assert.match(prompt, /previous_text/u); assert.match(prompt, /bible_original/u);
  assert.ok(!('approval' in evidence)); assert.ok(!('costs' in evidence));
});
test('Texto inventado e direção incompatível seguem o resultado real do auditor, não comparação lexical', async () => {
  const request = fixture(); request.text = 'Eu visitei Paris e reduzi as interrupções em 99%.';
  const auditor = new SemanticSourceReauditor({ async run(prompt) {
    assert.ok(prompt.includes(request.text));
    return { value: { result: 'reject', source_coverage: ['source_01'], findings: [
      { code: 'invented_experience', message: 'A fonte não contém visita a Paris nem porcentagem de 99%.', speech_id: request.speech_id },
      { code: 'direction_mismatch', message: 'Experiência pessoal contradiz direção fixada.', speech_id: request.speech_id }] }, usage: { input_tokens: 10, output_tokens: 30 } };
  } }, journal);
  const evidence = await auditor.audit(request);
  assert.equal(evidence.status, 'failed'); assert.equal(evidence.findings.length, 2); assert.ok(evidence.issues[0]!.required);
});
test('Fonte adulterada/ref errada é recusada antes da inferência; respostas inválidas/indisponibilidade permanecem unknown', async () => {
  let calls = 0; const auditor = new SemanticSourceReauditor({ async run() { calls++; return { value: pass, usage: { input_tokens: 1, output_tokens: 1 } }; } }, journal);
  const altered = fixture(); altered.snapshot.article.content += ' alteração';
  await assert.rejects(auditor.audit(altered), /snapshot e fontes/);
  const wrongRef = fixture(); wrongRef.dossier.blocks[0]!.speeches[0]!.sources[0]!.document.version = 99;
  await assert.rejects(auditor.audit(wrongRef), /referências/); assert.equal(calls, 0);
  for (const value of [{ result: 'pass', findings: [], source_coverage: ['unknown_segment'] },
    { result: 'pass', findings: [{ code: 'invented', message: 'Falha', speech_id: 'missing_speech' }], source_coverage: ['source_01'] }, {}]) {
    const broken = new SemanticSourceReauditor({ async run() { return { value, usage: { input_tokens: 0, output_tokens: 0 } }; } }, journal);
    assert.equal((await broken.audit(fixture())).status, 'unknown');
  }
  assert.equal((await new SemanticSourceReauditor(null, journal).audit(fixture())).status, 'unknown');
  const unavailable = new SemanticSourceReauditor({ async run() { throw new Error('oauth_timeout_unknown'); } }, journal);
  const evidence = await unavailable.audit(fixture()); assert.equal(evidence.status, 'unknown'); assert.equal(evidence.usage, null);
});
test('Journal fixa comando/fingerprint, reutiliza resposta e pausa impede inferência', async () => {
  const rows = new Map<string, { fingerprint: string; result: InferenceResult }>(); let calls = 0;
  const cached: InferenceJournal = { async run(key, fingerprint, infer) { const old = rows.get(key);
    if (old) { if (old.fingerprint !== fingerprint) throw new Error('oauth_execution_conflict'); return { ...old.result, reused: true, source_execution_key: key }; }
    const result = await infer(); rows.set(key, { fingerprint, result }); return result; } };
  const auditor = new SemanticSourceReauditor({ async run() { calls++; return { value: pass, usage: { input_tokens: 1, output_tokens: 1 } }; } }, cached);
  await auditor.audit(fixture()); assert.equal((await auditor.audit(fixture())).reused, true); assert.equal(calls, 1);
  const changed = fixture(); changed.text += ' Outra edição.'; await assert.rejects(auditor.audit(changed), /reutilizado/);
  const paused = new SemanticSourceReauditor({ async run() { throw new Error('should_not_run'); } }, journal, async () => false);
  assert.equal((await paused.audit(fixture())).status, 'unknown');
});
test('Pass sem cobertura integral ou com findings continua falha e perde aprovação', async () => {
  for (const value of [{ result: 'pass', findings: [], source_coverage: [] },
    { result: 'pass', findings: [{ code: 'contradiction', message: 'A edição contradiz fonte.', speech_id: 'speech_01' }], source_coverage: ['source_01'] }]) {
    const auditor = new SemanticSourceReauditor({ async run() { return { value, usage: { input_tokens: 1, output_tokens: 1 } }; } }, journal);
    assert.equal((await auditor.audit(fixture())).status, 'failed');
  }
});
