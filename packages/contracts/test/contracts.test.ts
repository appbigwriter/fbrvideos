import test from 'node:test';
import assert from 'node:assert/strict';
import { AdapterRequestSchema, ApprovalSchema, ArticleSchema, EvaluationSchema, ExportManifestSchema,
  ProductionCommandSchema, ProductionViewSchema, ProfileSchema, SpeechSchema, TimelineSchema } from '../src/index.js';
import { approvalFixture, articleFixture, dossierFixture, fixtureCosts, fixtureDelivery, fixtureHash, fixtureRefs,
  jobFixture, profileFixture, productionFixture, productionViewFixtures, renderEvaluationFixture, renderFixture } from '../src/fixtures.js';
import { budgetPreflight, canRetry, inspectDossier, productionApprovalValid, productionEligibility } from '../../domain/src/index.js';

const clone = <T>(v: T): T => structuredClone(v);

test('fixtures de produção e dossiê têm vínculos íntegros, sem representar mídia real', () => {
  assert.deepEqual(inspectDossier(dossierFixture, articleFixture, profileFixture), []);
  for (const value of Object.values(productionViewFixtures)) assert.ok(ProductionViewSchema.safeParse(value).success);
  assert.equal(renderFixture.origin, 'fixture');
});

test('fonte incompleta e autoria ausente impedem produção', () => {
  const incomplete = ArticleSchema.parse({ ...articleFixture, complete: false, character: null, status: 'incomplete' });
  const eligibility = productionEligibility(incomplete, profileFixture, 'calibration');
  assert.equal(eligibility.allowed, false);
  assert.deepEqual(eligibility.blockers.map(i => i.code), ['source_incomplete', 'author_unassigned']);
});

test('perfil em calibração não permite operação recorrente', () => {
  assert.equal(productionEligibility(articleFixture, profileFixture, 'calibration').allowed, true);
  assert.equal(productionEligibility(articleFixture, profileFixture, 'recurring').allowed, false);
  assert.equal(ProfileSchema.safeParse({ ...profileFixture, status: 'validated' }).success, false);
});

test('afirmações e experiências exigem fonte; vínculo para revisão inexistente é detectado', () => {
  const speech = dossierFixture.blocks[0]!.speeches[0]!;
  assert.equal(SpeechSchema.safeParse({ ...speech, kind: 'experiencia_pessoal', sources: [] }).success, false);
  const dossier = clone(dossierFixture);
  dossier.blocks[0]!.speeches[0]!.sources[0]!.document.version = 2;
  assert.ok(inspectDossier(dossier, articleFixture, profileFixture).some(i => i.code === 'source_missing'));
});

test('material editorial exige aprovação ativa de sua versão', () => {
  const dossier = clone(dossierFixture);
  dossier.blocks[0]!.speeches[0]!.sources[0]!.kind = 'approved_editorial';
  assert.ok(inspectDossier(dossier, articleFixture, profileFixture).some(i => i.code === 'editorial_source_unapproved'));
});

test('IDs de fala e classes/referências proibidas são detectados entre entidades', () => {
  const dossier = clone(dossierFixture);
  dossier.shots[0]!.speech_segment_ids = ['speech_missing'];
  dossier.shots[0]!.shot_class = 'simple_interaction';
  dossier.shots[0]!.references.style = { id: 'style_not_allowed', version: 1 };
  const codes = inspectDossier(dossier, articleFixture, profileFixture).map(i => i.code);
  assert.ok(codes.includes('shot_speech_missing'));
  assert.ok(codes.includes('shot_class_not_allowed'));
  assert.ok(codes.includes('reference_not_allowed'));
});

test('job concluído não aprova uma avaliação e falha obrigatória não é compensada', () => {
  const evaluation = clone(renderEvaluationFixture);
  evaluation.criteria[0]!.result = 'fail';
  assert.equal(EvaluationSchema.safeParse(evaluation).success, false);
  assert.equal(EvaluationSchema.safeParse({ ...renderEvaluationFixture, method: 'model_signal' }).success, false);
  const dossier = clone(dossierFixture);
  dossier.evaluations = dossier.evaluations.filter(e => e.id !== renderEvaluationFixture.id);
  assert.ok(inspectDossier(dossier, articleFixture, profileFixture).some(i => i.code === 'asset_approval_missing'));
});

test('custo desconhecido bloqueia novo gasto e compromissos são somados sem dupla contagem', () => {
  const costs = { ...fixtureCosts, confirmed_minor: 7000, committed_minor: 1000 };
  assert.deepEqual(budgetPreflight(costs, 1000), []);
  assert.equal(budgetPreflight(costs, 1001)[0]!.code, 'budget_exceeded');
  assert.equal(budgetPreflight(costs, null)[0]!.code, 'cost_unknown');
  assert.equal(budgetPreflight(costs, 0.5)[0]!.code, 'cost_invalid');
});

test('timeout não permite retry cego; sucesso e limite de tentativas impedem repetição', () => {
  const error = { code: 'provider_unavailable' as const, message: 'Falha transitória', retryable: true, correlation_id: 'error_fixture', issues: [] };
  assert.equal(canRetry({ ...jobFixture, status: 'unknown', external_job_id: 'external_01', error }, 2), false);
  assert.equal(canRetry(jobFixture, 2), false);
  assert.equal(canRetry({ ...jobFixture, status: 'failed', error }, 2), true);
  assert.equal(canRetry({ ...jobFixture, status: 'failed', attempt: 2, error }, 2), false);
});

test('timeline bloqueia tempos fora da duração e trim maior que áudio efetivo', () => {
  const dossier = clone(dossierFixture);
  dossier.timeline!.audio[0]!.source_out_seconds = 9;
  assert.ok(inspectDossier(dossier, articleFixture, profileFixture).some(i => i.code === 'timeline_trim_invalid'));
  dossier.timeline!.audio[0]!.end_seconds = 9;
  assert.equal(TimelineSchema.safeParse(dossier.timeline).success, false);
});

test('timeline não aceita reutilização de asset desatualizado', () => {
  const dossier = clone(dossierFixture);
  dossier.assets[0]!.status = 'outdated';
  assert.ok(inspectDossier(dossier, articleFixture, profileFixture).some(i => i.code === 'timeline_asset_invalid'));
});

test('aprovação final exige revisão integral declarada e render exato', () => {
  assert.equal(ApprovalSchema.safeParse({ ...approvalFixture, reviewed_in_full: false }).success, false);
  assert.equal(ProductionCommandSchema.safeParse({ command_id: 'cmd_fixture', production: fixtureRefs.production, action: 'approve_final' }).success, false);
  const production = { ...productionFixture, current_approval: { id: approvalFixture.id, version: 1 } };
  assert.equal(productionApprovalValid(production, renderFixture, approvalFixture, [renderEvaluationFixture]), true);
  assert.equal(productionApprovalValid(production, { ...renderFixture, version: 2 }, approvalFixture, [renderEvaluationFixture]), false);
  assert.equal(productionApprovalValid({ ...production, current_approval: { id: approvalFixture.id, version: 2 } }, renderFixture, approvalFixture, [renderEvaluationFixture]), false);
});

test('export aprovado rejeita aprovação antiga e pendência obrigatória; preview continua identificado', () => {
  const manifest = { ...renderFixture, id: 'manifest_fixture', status: 'approved_delivery', contract_version: '0.1.0',
    production: fixtureRefs.production, article: fixtureRefs.article, profile: fixtureRefs.profile, render: fixtureRefs.render,
    approval: approvalFixture, pending_issues: [], delivery: fixtureDelivery, assets: [renderFixture], costs: fixtureCosts };
  // Manifestos não incorporam campos de asset; o schema é estrito.
  const { type, file, origin, execution, specification, references, configuration_hash, usage, evaluation_refs, ...validManifest } = manifest;
  assert.equal(ExportManifestSchema.safeParse(validManifest).success, true);
  assert.equal(ExportManifestSchema.safeParse({ ...validManifest, approval: { ...approvalFixture, target: { ...fixtureRefs.render, version: 2 } } }).success, false);
  assert.equal(ExportManifestSchema.safeParse({ ...validManifest, pending_issues: productionViewFixtures.budget_exhausted.pending_issues }).success, false);
  assert.equal(ExportManifestSchema.safeParse({ ...validManifest, status: 'preview', approval: null }).success, true);
});

test('projeção de UI não anuncia entrega aprovada de uma revisão diferente', () => {
  const view = clone(productionViewFixtures.approved_delivery);
  view.current_render!.version = 2;
  assert.equal(ProductionViewSchema.safeParse(view).success, false);
});

test('projeção de UI distingue preview de entrega e aceita apenas asset render no player', () => {
  const view = productionViewFixtures.approved_delivery;
  assert.equal(ProductionViewSchema.safeParse({ ...view, export: { ...view.export, kind: null } }).success, false);
  assert.equal(ProductionViewSchema.safeParse({ ...view, export: { ...view.export, kind: 'preview' } }).success, false);
  assert.equal(ProductionViewSchema.safeParse({ ...view, current_render: { ...renderFixture, type: 'image' } }).success, false);
  assert.equal(ProductionViewSchema.safeParse({ ...view, current_render: { ...renderFixture, type: 'audio' } }).success, false);
  assert.equal(ProductionViewSchema.safeParse({ ...productionViewFixtures.review,
    export: { available: true, kind: 'preview', render: fixtureRefs.render, files: [] } }).success, true);
});

test('adapter de áudio recebe operação sem exigir plano visual', () => {
  const request = { contract_version: '0.1.0', execution_key: fixtureHash, attempt: 1, production: fixtureRefs.production,
    shot: null, operation: 'audio', route: null, input_assets: [], references: [fixtureRefs.voice],
    configuration_hash: fixtureHash, parameters: { text: 'Fala sintética' }, currency: 'BRL', reserved_minor: 0 };
  assert.equal(AdapterRequestSchema.safeParse(request).success, true);
  assert.equal(AdapterRequestSchema.safeParse({ ...request, operation: 'image', route: 'still_image' }).success, false);
});

test('contratos estritos rejeitam credenciais ou campos não declarados', () => {
  assert.equal(ArticleSchema.safeParse({ ...articleFixture, api_key: 'unexpected-secret' }).success, false);
});
