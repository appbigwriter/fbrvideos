import { ArticleSchema, AssetSchema, DossierSchema, EvaluationSchema, JobSchema, ProfileSchema,
  ProductionSchema, ShotPlanSchema, TimelineSchema, ApprovalSchema, CorrectionSchema } from './schemas.js';
import { ProductionViewSchema } from './presentation.js';
import type { ProductionView } from './presentation.js';
export * from './configuration-fixtures.js';

// Dados integralmente sintéticos. Valores de custo/formato não são recomendações nem resultados de piloto.
export const FIXTURE_NOTICE = 'SIMULAÇÃO S0 — texto, referências, mídia, custos e aprovações fictícios; não comprova integração nem qualidade.';
export const fixtureHash = 'a'.repeat(64);
const meta = (id: string) => ({ id, version: 1, created_at: '2026-10-04T12:00:00Z', author: 'fixture_operator', changes: [] });
export const fixtureRefs = { article: { id: 'article_fixture', version: 1 }, profile: { id: 'profile_fixture', version: 1 },
  character: { id: 'character_fixture', version: 1 }, voice: { id: 'voice_fixture', version: 1 },
  environment: { id: 'environment_fixture', version: 1 }, style: { id: 'style_fixture', version: 1 },
  composition: { id: 'composition_fixture', version: 1 }, production: { id: 'production_fixture', version: 1 },
  shot: { id: 'shot_fixture', version: 1 }, dossier: { id: 'dossier_fixture', version: 1 },
  image: { id: 'image_fixture', version: 1 }, audio: { id: 'audio_fixture', version: 1 }, render: { id: 'render_fixture', version: 1 } };
export const fixtureCosts = { currency: 'BRL', estimated_minor: null, committed_minor: 0, confirmed_minor: 0,
  ceiling_minor: 10000, safety_margin_minor: 1000 };
export const fixtureDelivery = { width: 1080, height: 1920, fps: 30, video_codec: 'h264', audio_codec: 'aac',
  audio_sample_rate: 48000, subtitle_format: 'srt' as const };

export const articleFixture = ArticleSchema.parse({ ...meta(fixtureRefs.article.id), status: 'available',
  title: 'Organizar notificações — artigo sintético', source: { kind: 'manual', url: null, captured_at: '2026-10-04T12:00:00Z' },
  source_author: 'Autora fictícia S0', character: fixtureRefs.character,
  content: 'Ajustar as notificações reduz interrupções durante tarefas que exigem concentração.', content_hash: fixtureHash, complete: true,
  segments: [{ id: 'source_01', text: 'Ajustar as notificações reduz interrupções durante tarefas que exigem concentração.' }], source_images: [] });

export const profileFixture = ProfileSchema.parse({ ...meta(fixtureRefs.profile.id), status: 'calibrating',
  name: 'Perfil de demonstração S0', character: fixtureRefs.character, language: 'pt-BR', target_seconds: 8,
  recipe: 'explanation_fixture', permitted_shot_classes: ['editorial_illustration'],
  permitted_references: [fixtureRefs.voice, fixtureRefs.environment, fixtureRefs.style, fixtureRefs.composition],
  voice: fixtureRefs.voice, delivery: fixtureDelivery, budget: { currency: 'BRL', ceiling_minor: 10000,
    safety_margin_minor: 1000, max_attempts_per_job: 2 }, calibration_scope: null });

export const shotFixture = ShotPlanSchema.parse({ ...meta(fixtureRefs.shot.id), status: 'specified',
  block_id: 'block_01', intent: 'Ilustrar organização de notificações', route: 'still_image', shot_class: 'editorial_illustration',
  speech_segment_ids: ['speech_01'], references: { character: null, environment: fixtureRefs.environment,
    wardrobe: null, props: [], style: fixtureRefs.style, composition: fixtureRefs.composition },
  visual: { framing: 'Plano de detalhe', required_elements: ['celular ilustrativo', 'mesa'],
    initial_state: 'Celular sobre mesa', action: 'Exibir celular com notificações desativadas', final_state: 'Celular sobre mesa',
    camera: 'Frontal estática', camera_motion: 'Nenhum', subject_motion: 'Nenhum', layout: 'Celular centralizado',
    lighting: 'Difusa', subtitle_safe_area: 'Faixa inferior reservada', fixed_elements: ['mesa', 'celular'] },
  duration: { target_seconds: 8, resolved_seconds: 8 }, continuity_in: [], continuity_out: [], dependencies: [],
  constraints: ['Imagem ilustrativa, não registro real'], risks: ['Texto ilegível na tela'], mandatory_criteria: ['correspondência fala/imagem'],
  fallback: { description: 'Composição alternativa de mesa sem celular', route: 'still_image', changes_narrative_intent: false } });

function evaluation(id: string, target: { id: string; version: number }) {
  return EvaluationSchema.parse({ ...meta(id), status: 'approved', target, method: 'human',
    criteria: [{ name: 'Integridade da simulação', mandatory: true, result: 'pass', evidence: FIXTURE_NOTICE,
      timecode_seconds: null, corrective_action: null }] });
}
export const imageEvaluationFixture = evaluation('evaluation_image_fixture', fixtureRefs.image);
export const audioEvaluationFixture = evaluation('evaluation_audio_fixture', fixtureRefs.audio);
export const renderEvaluationFixture = evaluation('evaluation_render_fixture', fixtureRefs.render);

export const imageFixture = AssetSchema.parse({ ...meta(fixtureRefs.image.id), status: 'approved', type: 'image',
  file: { storage_key: 'fixtures/no-real-image.png', hash: fixtureHash, mime_type: 'image/png', bytes: 1,
    width: 1080, height: 1920, duration_seconds: null }, origin: 'fixture', execution: null, specification: fixtureRefs.shot,
  references: [fixtureRefs.style, fixtureRefs.composition], configuration_hash: fixtureHash,
  usage: { permission: 'allowed', evidence: FIXTURE_NOTICE }, evaluation_refs: [{ id: imageEvaluationFixture.id, version: 1 }] });
export const audioFixture = AssetSchema.parse({ ...imageFixture, ...meta(fixtureRefs.audio.id), type: 'audio',
  file: { storage_key: 'fixtures/no-real-audio.wav', hash: fixtureHash, mime_type: 'audio/wav', bytes: 1,
    width: null, height: null, duration_seconds: 8 }, specification: fixtureRefs.dossier, references: [fixtureRefs.voice],
  evaluation_refs: [{ id: audioEvaluationFixture.id, version: 1 }] });
export const renderFixture = AssetSchema.parse({ ...imageFixture, ...meta(fixtureRefs.render.id), type: 'render',
  file: { storage_key: 'fixtures/no-real-render.mp4', hash: fixtureHash, mime_type: 'video/mp4', bytes: 1,
    width: 1080, height: 1920, duration_seconds: 8 }, specification: { id: 'timeline_fixture', version: 1 },
  references: [fixtureRefs.image, fixtureRefs.audio], evaluation_refs: [{ id: renderEvaluationFixture.id, version: 1 }] });

export const approvalFixture = ApprovalSchema.parse({ ...meta('approval_fixture'), status: 'active',
  target: fixtureRefs.render, kind: 'final', reviewer: 'fixture_operator', method: 'human', reviewed_in_full: true,
  evaluation_refs: [{ id: renderEvaluationFixture.id, version: 1 }] });
export const timelineFixture = TimelineSchema.parse({ ...meta('timeline_fixture'), status: 'rendered', production: fixtureRefs.production,
  duration_seconds: 8, delivery: fixtureDelivery,
  audio: [{ start_seconds: 0, end_seconds: 8, speech_segment_id: 'speech_01', asset: fixtureRefs.audio, source_in_seconds: 0, source_out_seconds: 8 }],
  video: [{ start_seconds: 0, end_seconds: 8, shot: fixtureRefs.shot, asset: fixtureRefs.image,
    source_in_seconds: 0, source_out_seconds: 8, clip_audio: 'muted' }],
  subtitles: [{ start_seconds: 0, end_seconds: 8, speech_segment_id: 'speech_01', text: articleFixture.content }], music: [], transitions: [] });
export const jobFixture = JobSchema.parse({ ...meta('job_fixture'), status: 'succeeded', production: fixtureRefs.production,
  stage: 'image', provider: 'simulated', model: null, external_job_id: null, execution_key: fixtureHash, attempt: 1,
  inputs: [fixtureRefs.shot], configuration_hash: fixtureHash, sent_parameters: { simulation: true }, unsupported_fields: [],
  output_assets: [fixtureRefs.image], costs: { currency: 'BRL', estimated_minor: null, committed_minor: 0, confirmed_minor: 0 }, error: null });
export const dossierFixture = DossierSchema.parse({ ...meta(fixtureRefs.dossier.id), status: 'specified',
  production: fixtureRefs.production, article: fixtureRefs.article, profile: fixtureRefs.profile, character: fixtureRefs.character,
  briefing: { objective: 'Explicar uma ideia do artigo sintético', audience: 'Operador testando a base', message: articleFixture.content,
    narrative_situation: 'Comentário em off', visual_arc: 'Imagem editorial estática', omitted_content: [] }, editorial_sources: [],
  blocks: [{ id: 'block_01', sequence: 0, intent: 'Apresentar recomendação', visual_function: 'contextualize',
    speeches: [{ id: 'speech_01', text: articleFixture.content, kind: 'afirmacao_factual', mode: 'voice_over',
      sources: [{ kind: 'article', document: fixtureRefs.article, segment_id: 'source_01' }] }] }],
  shots: [shotFixture], assets: [imageFixture, audioFixture, renderFixture], jobs: [jobFixture],
  evaluations: [imageEvaluationFixture, audioEvaluationFixture, renderEvaluationFixture], approvals: [approvalFixture],
  timeline: timelineFixture, pending_issues: [] });

export const productionFixture = ProductionSchema.parse({ ...meta(fixtureRefs.production.id), status: 'ready_for_review',
  stage: 'review', name: 'Produção sintética S0', mode: 'calibration', article: fixtureRefs.article, profile: fixtureRefs.profile,
  character: fixtureRefs.character, dossier: fixtureRefs.dossier, current_render: fixtureRefs.render, current_approval: null,
  costs: fixtureCosts, pending_issues: [] });
const enabled = { enabled: true, reason: null };
const disabled = (reason: string) => ({ enabled: false, reason });
const eligibility = { allowed: true, calibration_only: true, blockers: [] };
const viewBase = ProductionViewSchema.parse({ ref: fixtureRefs.production, name: productionFixture.name,
  status: 'ready_for_review', stage: 'review', article: { ref: fixtureRefs.article, title: articleFixture.title,
    source_author: articleFixture.source_author, character: fixtureRefs.character, eligibility },
  profile: { ref: fixtureRefs.profile, name: profileFixture.name, status: 'calibrating', eligibility }, costs: fixtureCosts,
  pending_issues: [], current_render: renderFixture, current_approval: null, correction: null,
  actions: { generate: disabled('Produção já iniciada.'), pause: disabled('Nenhum job novo pendente.'), resume: disabled('Produção em revisão.'),
    cancel: enabled, correct: enabled, approve: enabled, export: disabled('A versão ainda precisa de aprovação.') },
  export: { available: false, kind: 'preview', render: fixtureRefs.render, files: [] } });
const parseView = (v: ProductionView) => ProductionViewSchema.parse(v);
const sourceIssue = { code: 'source_incomplete', message: 'O conteúdo está incompleto.', next_action: 'Corrigir a extração ou colar o texto.', required: true };
const budgetIssue = { code: 'budget_exceeded', message: 'O teto seguro de custo foi atingido.', next_action: 'Ajustar limite ou escolher alternativa.', required: true };
const failedIssue = { code: 'provider_unavailable', message: 'Não foi possível consultar o fornecedor.', next_action: 'Consultar job antes de repetir.', required: true };
export const correctionFixture = CorrectionSchema.parse({ ...meta('correction_fixture'), status: 'awaiting_cost_authorization',
  production: fixtureRefs.production, render: fixtureRefs.render, shot: fixtureRefs.shot, category: 'image_mismatch',
  comment: 'A imagem não representa a fala.', impact: { invalidated: [fixtureRefs.image, fixtureRefs.render],
    preserved: [fixtureRefs.article, fixtureRefs.audio], approval_invalidated: true },
  costs: { ...fixtureCosts, estimated_minor: 500 }, additional_cost_authorized: false });
export const productionViewFixtures = {
  review: viewBase,
  preparing: parseView({ ...viewBase, status: 'preparing', stage: 'preparation', current_render: null,
    actions: { ...viewBase.actions, correct: disabled('Sem render.'), approve: disabled('Sem render.'), pause: enabled },
    export: { available: false, kind: null, render: null, files: [] } }),
  source_incomplete: parseView({ ...viewBase, status: 'awaiting_decision', stage: 'preparation', current_render: null,
    pending_issues: [sourceIssue], article: { ...viewBase.article, eligibility: { allowed: false, calibration_only: true, blockers: [sourceIssue] } },
    actions: { ...viewBase.actions, generate: disabled(sourceIssue.message), correct: disabled('Sem render.'), approve: disabled(sourceIssue.message) },
    export: { available: false, kind: null, render: null, files: [] } }),
  failure: parseView({ ...viewBase, status: 'failed', stage: 'generation', current_render: null, pending_issues: [failedIssue],
    actions: { ...viewBase.actions, correct: disabled('Sem render.'), approve: disabled(failedIssue.message), resume: disabled('Reconciliar job externo antes de retomar.') },
    export: { available: false, kind: null, render: null, files: [] } }),
  budget_exhausted: parseView({ ...viewBase, status: 'awaiting_decision', stage: 'generation', current_render: null,
    pending_issues: [budgetIssue], costs: { ...fixtureCosts, confirmed_minor: 8000, committed_minor: 1000 },
    actions: { ...viewBase.actions, generate: disabled(budgetIssue.message), resume: disabled(budgetIssue.message),
      correct: disabled('Sem render.'), approve: disabled('Sem render.') }, export: { available: false, kind: null, render: null, files: [] } }),
  correction: parseView({ ...viewBase, status: 'correcting', correction: correctionFixture,
    actions: { ...viewBase.actions, approve: disabled('Plano de correção aguarda autorização de custo.'),
      correct: disabled('Já existe um plano de correção pendente.') } }),
  approved_delivery: parseView({ ...viewBase, status: 'approved', stage: 'delivery', current_approval: approvalFixture,
    actions: { ...viewBase.actions, approve: disabled('Versão já aprovada.'), export: enabled },
    export: { available: true, kind: 'approved_delivery', render: fixtureRefs.render,
      files: [{ asset: fixtureRefs.render, label: 'Vídeo da simulação (sem arquivo real)', download_action: 'fixture_unavailable' }] } }),
} satisfies Record<string, ProductionView>;
