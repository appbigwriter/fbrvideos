import { z } from 'zod';

export const CONTRACT_VERSION = '0.1.0' as const;
const text = z.string().trim().min(1);
export const IdSchema = text.regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/);
export const VersionRefSchema = z.strictObject({ id: IdSchema, version: z.int().positive() });
export const TimestampSchema = z.iso.datetime();
export const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const MoneySchema = z.int().nonnegative();
export const CurrencySchema = z.string().regex(/^[A-Z]{3}$/);
const nullableText = text.nullable();
export const ChangeSchema = z.strictObject({ at: TimestampSchema, author: IdSchema, reason: text });
const versioned = {
  id: IdSchema, version: z.int().positive(), created_at: TimestampSchema,
  author: IdSchema, changes: z.array(ChangeSchema),
};

export const IssueSchema = z.strictObject({
  code: text, message: text, next_action: text, required: z.boolean(),
});
export const ErrorSchema = z.strictObject({
  code: z.enum(['validation', 'not_found', 'conflict', 'ineligible', 'budget_exceeded',
    'attempts_exceeded', 'provider_unavailable', 'provider_unknown', 'capability_missing', 'internal']),
  message: text, retryable: z.boolean(), correlation_id: IdSchema,
  issues: z.array(IssueSchema),
});
export const EligibilitySchema = z.strictObject({
  allowed: z.boolean(), calibration_only: z.boolean(), blockers: z.array(IssueSchema),
}).refine(v => !v.allowed || !v.blockers.some(i => i.required), {
  message: 'Elegibilidade não pode ignorar impedimento obrigatório',
});

export const ArticleSchema = z.strictObject({
  ...versioned,
  status: z.enum(['imported', 'incomplete', 'association_pending', 'available', 'source_changed']),
  title: text, source: z.strictObject({ kind: z.enum(['url', 'manual']), url: z.url().nullable(), captured_at: TimestampSchema }),
  source_author: text, character: VersionRefSchema.nullable(), content: text, content_hash: HashSchema,
  complete: z.boolean(), segments: z.array(z.strictObject({ id: IdSchema, text })).min(1),
  source_images: z.array(z.strictObject({ uri: text, usage_permission: z.enum(['unknown', 'allowed', 'denied']), evidence: nullableText })),
}).superRefine((value, ctx) => {
  if (value.source.kind === 'url' && value.source.url === null) ctx.addIssue({ code: 'custom', message: 'Origem URL exige URL registrada' });
  if (value.status === 'available' && (!value.complete || !value.character)) ctx.addIssue({ code: 'custom', message: 'Artigo disponível exige captura completa e personagem' });
  if (new Set(value.segments.map(s => s.id)).size !== value.segments.length) ctx.addIssue({ code: 'custom', message: 'Trechos devem ter IDs únicos' });
});

export const ReferenceSchema = z.strictObject({
  ...versioned, status: z.enum(['pending', 'approved', 'archived']),
  kind: z.enum(['character', 'environment', 'wardrobe', 'prop', 'style', 'voice', 'composition']),
  name: text, asset_refs: z.array(VersionRefSchema), rules: z.array(text),
  usage_permission: z.enum(['unknown', 'allowed', 'denied']),
});
export const CharacterSchema = z.strictObject({
  ...versioned, status: z.enum(['draft', 'confirmed', 'archived']), name: text,
  bible: z.strictObject({ original_uri: text, original_hash: HashSchema, interpretation: text, interpretation_confirmed: z.boolean() }),
  references: z.array(VersionRefSchema), voice: VersionRefSchema.nullable(), authorized_variations: z.array(text),
});

export const RouteSchema = z.enum(['avatar', 'animated_scene', 'still_image', 'existing_asset']);
export const ShotClassSchema = z.enum(['avatar_on_camera', 'simple_character_motion', 'detail_without_manipulation',
  'environment_without_character', 'editorial_illustration', 'simple_interaction']);
export const DeliveryProfileSchema = z.strictObject({
  width: z.int().positive(), height: z.int().positive(), fps: z.number().positive(),
  video_codec: text, audio_codec: text, audio_sample_rate: z.int().positive(),
  subtitle_format: z.enum(['srt', 'vtt']),
});
export const BudgetPolicySchema = z.strictObject({
  currency: CurrencySchema, ceiling_minor: MoneySchema, safety_margin_minor: MoneySchema,
  max_attempts_per_job: z.int().positive(),
}).refine(v => v.safety_margin_minor <= v.ceiling_minor, { message: 'Margem excede teto' });
export const ProfileSchema = z.strictObject({
  ...versioned, status: z.enum(['draft', 'calibrating', 'validated', 'suspended']), name: text,
  character: VersionRefSchema, language: text, target_seconds: z.number().positive().nullable(),
  recipe: nullableText, permitted_shot_classes: z.array(ShotClassSchema), permitted_references: z.array(VersionRefSchema),
  voice: VersionRefSchema.nullable(), delivery: DeliveryProfileSchema.nullable(), budget: BudgetPolicySchema.nullable(),
  calibration_scope: z.strictObject({ article_classes: z.array(text), formats: z.array(text), evidence_refs: z.array(text) }).nullable(),
}).superRefine((v, ctx) => {
  if (v.status === 'validated' && (!v.recipe || !v.voice || !v.delivery || !v.budget || !v.target_seconds
      || !v.permitted_shot_classes.length || !v.calibration_scope?.evidence_refs.length
      || !v.calibration_scope.article_classes.length || !v.calibration_scope.formats.length)) {
    ctx.addIssue({ code: 'custom', message: 'Perfil validado exige configuração e evidência do escopo' });
  }
});

export const CostSummarySchema = z.strictObject({
  currency: CurrencySchema, estimated_minor: MoneySchema.nullable(), committed_minor: MoneySchema,
  confirmed_minor: MoneySchema, ceiling_minor: MoneySchema, safety_margin_minor: MoneySchema,
});
export const ProductionStateSchema = z.enum(['preparing', 'producing', 'awaiting_decision', 'paused',
  'failed', 'ready_for_review', 'correcting', 'approved', 'exported', 'cancelled']);
export const ProductionStageSchema = z.enum(['preparation', 'script_direction', 'generation', 'assembly', 'review', 'delivery']);
export const ProductionSchema = z.strictObject({
  ...versioned, status: ProductionStateSchema, stage: ProductionStageSchema, name: text,
  mode: z.enum(['calibration', 'recurring']), article: VersionRefSchema, profile: VersionRefSchema,
  character: VersionRefSchema, dossier: VersionRefSchema.nullable(), current_render: VersionRefSchema.nullable(),
  current_approval: VersionRefSchema.nullable(), costs: CostSummarySchema, pending_issues: z.array(IssueSchema),
}).superRefine((v, ctx) => {
  if (v.status === 'awaiting_decision' && !v.pending_issues.length) ctx.addIssue({ code: 'custom', message: 'Decisão exige pendência objetiva' });
  if ((v.status === 'approved' || v.status === 'exported') && (!v.current_render || !v.current_approval || v.pending_issues.some(i => i.required))) {
    ctx.addIssue({ code: 'custom', message: 'Produção aprovada exige render, aprovação e ausência de pendência obrigatória' });
  }
});

export const SourceRefSchema = z.strictObject({
  kind: z.enum(['article', 'approved_editorial']), document: VersionRefSchema, segment_id: IdSchema,
});
export const SpeechSchema = z.strictObject({
  id: IdSchema, text, kind: z.enum(['afirmacao_factual', 'experiencia_pessoal', 'opiniao_editorial', 'transicao_convite']),
  mode: z.enum(['on_camera', 'voice_over', 'pause']), sources: z.array(SourceRefSchema),
}).refine(v => !['afirmacao_factual', 'experiencia_pessoal'].includes(v.kind) || v.sources.length > 0,
  { message: 'Fato ou experiência pessoal exige fonte', path: ['sources'] });
export const NarrativeBlockSchema = z.strictObject({
  id: IdSchema, sequence: z.int().nonnegative(), intent: text,
  visual_function: z.enum(['present', 'demonstrate', 'contextualize', 'compare', 'reflect', 'conclude']),
  speeches: z.array(SpeechSchema).min(1),
});
export const ShotPlanSchema = z.strictObject({
  ...versioned,
  status: z.enum(['draft', 'specified', 'storyboard_approved', 'image_approved', 'clip_approved', 'assembled']),
  block_id: IdSchema, intent: text, route: RouteSchema, shot_class: ShotClassSchema,
  speech_segment_ids: z.array(IdSchema).min(1),
  references: z.strictObject({ character: VersionRefSchema.nullable(), environment: VersionRefSchema.nullable(),
    wardrobe: VersionRefSchema.nullable(), props: z.array(VersionRefSchema), style: VersionRefSchema.nullable(), composition: VersionRefSchema.nullable() }),
  visual: z.strictObject({ framing: text, required_elements: z.array(text).min(1), initial_state: text,
    action: text, final_state: text, camera: text, camera_motion: text, subject_motion: text,
    layout: text, lighting: text, subtitle_safe_area: text, fixed_elements: z.array(text) }),
  duration: z.strictObject({ target_seconds: z.number().positive().nullable(), resolved_seconds: z.number().positive().nullable() }),
  continuity_in: z.array(text), continuity_out: z.array(text), dependencies: z.array(VersionRefSchema),
  constraints: z.array(text), risks: z.array(text), mandatory_criteria: z.array(text).min(1),
  fallback: z.strictObject({ description: text, route: RouteSchema, changes_narrative_intent: z.boolean() }),
});

export const AssetSchema = z.strictObject({
  ...versioned, status: z.enum(['candidate', 'approved', 'rejected', 'outdated']),
  type: z.enum(['image', 'audio', 'clip', 'subtitle', 'render', 'manifest']),
  file: z.strictObject({ storage_key: text, hash: HashSchema, mime_type: text, bytes: z.int().positive(),
    width: z.int().positive().nullable(), height: z.int().positive().nullable(), duration_seconds: z.number().positive().nullable() }),
  origin: z.enum(['provider', 'uploaded', 'rendered', 'fixture']),
  execution: VersionRefSchema.nullable(), specification: VersionRefSchema,
  references: z.array(VersionRefSchema), configuration_hash: HashSchema,
  usage: z.strictObject({ permission: z.enum(['unknown', 'allowed', 'denied']), evidence: nullableText }),
  evaluation_refs: z.array(VersionRefSchema),
}).refine(v => v.status !== 'approved' || (v.usage.permission === 'allowed' && v.evaluation_refs.length > 0),
  { message: 'Asset aprovado exige direito de uso e avaliação registrada' });

export const JobStateSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled', 'unknown']);
export const JobSchema = z.strictObject({
  ...versioned, status: JobStateSchema, production: VersionRefSchema,
  stage: z.enum(['planning', 'storyboard', 'audio', 'image', 'avatar', 'animation', 'render', 'export']),
  provider: nullableText, model: nullableText, external_job_id: nullableText,
  execution_key: HashSchema, attempt: z.int().positive(), inputs: z.array(VersionRefSchema),
  configuration_hash: HashSchema, sent_parameters: z.record(text, z.json()), unsupported_fields: z.array(text),
  output_assets: z.array(VersionRefSchema), costs: z.strictObject({ currency: CurrencySchema,
    estimated_minor: MoneySchema.nullable(), committed_minor: MoneySchema, confirmed_minor: MoneySchema.nullable() }),
  error: ErrorSchema.nullable(),
}).refine(v => v.status !== 'failed' || v.error !== null, { message: 'Job falho exige diagnóstico' });

export const EvaluationStateSchema = z.enum(['approved', 'rejected', 'needs_review']);
export const EvaluationSchema = z.strictObject({
  ...versioned, status: EvaluationStateSchema, target: VersionRefSchema,
  method: z.enum(['deterministic', 'model_signal', 'human']),
  criteria: z.array(z.strictObject({ name: text, mandatory: z.boolean(),
    result: z.enum(['pass', 'fail', 'needs_review', 'not_applicable']), evidence: text,
    timecode_seconds: z.number().nonnegative().nullable(), corrective_action: nullableText })).min(1),
}).superRefine((v, ctx) => {
  if (v.status === 'approved' && v.criteria.some(c => c.mandatory && ['fail', 'needs_review'].includes(c.result))) {
    ctx.addIssue({ code: 'custom', message: 'Falha obrigatória não pode receber aprovação' });
  }
  if (v.status === 'approved' && v.method === 'model_signal') ctx.addIssue({ code: 'custom', message: 'Sinal de modelo não é aprovação' });
});

const timed = { start_seconds: z.number().nonnegative(), end_seconds: z.number().positive() };
const clipSegment = z.strictObject({ ...timed, shot: VersionRefSchema, asset: VersionRefSchema,
  source_in_seconds: z.number().nonnegative(), source_out_seconds: z.number().positive(),
  clip_audio: z.enum(['muted', 'official_audio']) }).refine(v => v.end_seconds > v.start_seconds && v.source_out_seconds > v.source_in_seconds,
  { message: 'Intervalo audiovisual inválido' });
const audioSegment = z.strictObject({ ...timed, speech_segment_id: IdSchema, asset: VersionRefSchema,
  source_in_seconds: z.number().nonnegative(), source_out_seconds: z.number().positive() })
  .refine(v => v.end_seconds > v.start_seconds && v.source_out_seconds > v.source_in_seconds, { message: 'Intervalo de áudio inválido' });
const subtitleSegment = z.strictObject({ ...timed, speech_segment_id: IdSchema, text })
  .refine(v => v.end_seconds > v.start_seconds, { message: 'Intervalo de legenda inválido' });
export const SubtitleLayoutSchema = z.strictObject({
  max_characters_per_line: z.int().min(10).max(100), max_lines: z.int().min(1).max(3),
  max_characters_per_second: z.number().positive().finite(),
  safe_area: z.strictObject({ left: z.number().min(0).max(1), top: z.number().min(0).max(1),
    right: z.number().min(0).max(1), bottom: z.number().min(0).max(1) }),
}).refine(v => v.safe_area.left < v.safe_area.right && v.safe_area.top < v.safe_area.bottom,
  { message: 'Área reservada de legenda inválida' });
export const TimelineSchema = z.strictObject({
  ...versioned, status: z.enum(['draft', 'ready', 'rendered', 'outdated']),
  production: VersionRefSchema, duration_seconds: z.number().positive(), delivery: DeliveryProfileSchema,
  audio: z.array(audioSegment).min(1), video: z.array(clipSegment).min(1), subtitles: z.array(subtitleSegment),
  subtitle_layout: SubtitleLayoutSchema.optional(),
  music: z.array(z.strictObject({ asset: VersionRefSchema, gain_db: z.number(), ...timed })),
  transitions: z.array(z.strictObject({ at_seconds: z.number().nonnegative(), type: text, duration_seconds: z.number().nonnegative() })),
}).superRefine((v, ctx) => {
  for (const [kind, segments] of Object.entries({ audio: v.audio, video: v.video, subtitles: v.subtitles, music: v.music })) {
    if (segments.some(s => s.start_seconds >= s.end_seconds || s.end_seconds > v.duration_seconds)) ctx.addIssue({ code: 'custom', message: `${kind}: segmento fora da timeline` });
  }
  if (v.transitions.some(t => t.at_seconds + t.duration_seconds > v.duration_seconds)) ctx.addIssue({ code: 'custom', message: 'Transição fora da timeline' });
  if (v.subtitle_layout) for (const cue of v.subtitles) {
    const lines = cue.text.replace(/\r\n?/gu, '\n').split('\n');
    if (lines.length > v.subtitle_layout.max_lines || lines.some(line => !line.trim() || line.length > v.subtitle_layout!.max_characters_per_line))
      ctx.addIssue({ code: 'custom', message: 'Legenda excede linhas ou caracteres do layout fixado' });
    if (cue.text.replace(/\s+/gu, ' ').trim().length / (cue.end_seconds - cue.start_seconds) > v.subtitle_layout.max_characters_per_second)
      ctx.addIssue({ code: 'custom', message: 'Velocidade de leitura da legenda excede o layout fixado' });
  }
});

export const ApprovalSchema = z.strictObject({
  ...versioned, status: z.enum(['active', 'invalidated']), target: VersionRefSchema,
  kind: z.enum(['editorial', 'direction', 'audio', 'image', 'clip', 'final']),
  reviewer: IdSchema, method: z.literal('human'), reviewed_in_full: z.boolean(),
  evaluation_refs: z.array(VersionRefSchema).min(1),
}).refine(v => v.kind !== 'final' || v.reviewed_in_full, { message: 'Aprovação final exige declaração de revisão integral' });
export const DossierSchema = z.strictObject({
  ...versioned, status: z.enum(['draft', 'specified', 'ready', 'outdated']),
  production: VersionRefSchema, article: VersionRefSchema, profile: VersionRefSchema, character: VersionRefSchema,
  briefing: z.strictObject({ objective: text, audience: text, message: text, narrative_situation: text,
    visual_arc: text, omitted_content: z.array(text) }),
  editorial_sources: z.array(z.strictObject({ document: VersionRefSchema, segment_ids: z.array(IdSchema).min(1), approval: VersionRefSchema })),
  blocks: z.array(NarrativeBlockSchema).min(1), shots: z.array(ShotPlanSchema).min(1),
  assets: z.array(AssetSchema), jobs: z.array(JobSchema), evaluations: z.array(EvaluationSchema),
  approvals: z.array(ApprovalSchema), timeline: TimelineSchema.nullable(), pending_issues: z.array(IssueSchema),
});

export const CorrectionSchema = z.strictObject({
  ...versioned, status: z.enum(['proposed', 'awaiting_cost_authorization', 'authorized', 'running', 'completed', 'failed', 'cancelled']),
  production: VersionRefSchema, render: VersionRefSchema, shot: VersionRefSchema.nullable(),
  category: z.enum(['image_mismatch', 'identity', 'environment', 'motion', 'speech_voice', 'comment']), comment: text,
  impact: z.strictObject({ invalidated: z.array(VersionRefSchema), preserved: z.array(VersionRefSchema), approval_invalidated: z.boolean() }),
  costs: CostSummarySchema, additional_cost_authorized: z.boolean(),
}).refine(v => !['authorized', 'running', 'completed'].includes(v.status) || v.additional_cost_authorized,
  { message: 'Execução da correção exige autorização de seu plano de custos' });
export const ExportManifestSchema = z.strictObject({
  ...versioned, status: z.enum(['preview', 'approved_delivery']), contract_version: z.literal(CONTRACT_VERSION),
  production: VersionRefSchema, article: VersionRefSchema, profile: VersionRefSchema,
  render: VersionRefSchema, approval: ApprovalSchema.nullable(), pending_issues: z.array(IssueSchema),
  delivery: DeliveryProfileSchema, assets: z.array(AssetSchema).min(1), costs: CostSummarySchema,
}).superRefine((v, ctx) => {
  if (v.status === 'approved_delivery' && (!v.approval || v.approval.kind !== 'final' || v.approval.status !== 'active'
      || v.approval.target.id !== v.render.id || v.approval.target.version !== v.render.version
      || v.pending_issues.some(i => i.required))) ctx.addIssue({ code: 'custom', message: 'Entrega exige aprovação ativa do render exato e ausência de pendências obrigatórias' });
  if (!v.assets.some(a => a.id === v.render.id && a.version === v.render.version && a.type === 'render')) ctx.addIssue({ code: 'custom', message: 'Manifesto deve conter o render fixado' });
  if (v.status === 'approved_delivery' && v.assets.some(a => a.status !== 'approved' || a.usage.permission !== 'allowed')) ctx.addIssue({ code: 'custom', message: 'Entrega não pode incluir assets não aprovados' });
});

export type VersionRef = z.infer<typeof VersionRefSchema>;
export type Article = z.infer<typeof ArticleSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Production = z.infer<typeof ProductionSchema>;
export type ShotPlan = z.infer<typeof ShotPlanSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type Job = z.infer<typeof JobSchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;
export type Timeline = z.infer<typeof TimelineSchema>;
export type DeliveryProfile = z.infer<typeof DeliveryProfileSchema>;
export type Dossier = z.infer<typeof DossierSchema>;
export type Approval = z.infer<typeof ApprovalSchema>;
export type Correction = z.infer<typeof CorrectionSchema>;
export type ExportManifest = z.infer<typeof ExportManifestSchema>;
export type CostSummary = z.infer<typeof CostSummarySchema>;
export type Eligibility = z.infer<typeof EligibilitySchema>;
