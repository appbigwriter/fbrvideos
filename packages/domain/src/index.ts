import type { Approval, Article, Asset, CostSummary, Dossier, Eligibility, Evaluation, Job, Production, Profile, VersionRef } from '@fbr/contracts';
export * from './configuration.js';
export * from './production.js';
export * from './dependencies.js';
export * from './delivery.js';

export const sameRef = (a: VersionRef, b: VersionRef): boolean => a.id === b.id && a.version === b.version;
const issue = (code: string, message: string, next_action: string) => ({ code, message, next_action, required: true });

export function productionEligibility(article: Article, profile: Profile, mode: 'calibration' | 'recurring'): Eligibility {
  const blockers: Eligibility['blockers'] = [];
  if (!article.complete) blockers.push(issue('source_incomplete', 'A fonte está incompleta.', 'Corrigir a captura ou colar o texto completo.'));
  if (!article.character) blockers.push(issue('author_unassigned', 'A autora não possui personagem associada.', 'Confirmar associação de autoria.'));
  if (article.character && !sameRef(article.character, profile.character)) blockers.push(issue('character_mismatch', 'Artigo e perfil usam identidades diferentes.', 'Escolher perfil da personagem associada.'));
  if (profile.status === 'suspended') blockers.push(issue('profile_suspended', 'Perfil suspenso.', 'Selecionar outro perfil ou revisar sua configuração.'));
  if (mode === 'recurring' && profile.status !== 'validated') blockers.push(issue('calibration_required', 'O perfil permite apenas calibração.', 'Iniciar uma produção de calibração.'));
  if (!profile.recipe || !profile.voice || !profile.delivery || !profile.budget || !profile.target_seconds || !profile.permitted_shot_classes.length) {
    blockers.push(issue('profile_incomplete', 'Faltam parâmetros essenciais do perfil.', 'Completar receita, voz, formato, duração, repertório e limites.'));
  }
  return { allowed: blockers.length === 0, calibration_only: profile.status !== 'validated', blockers };
}

// Preflight local. A reserva concorrente ainda precisa de transação de banco em S3-B01.
export function budgetPreflight(costs: CostSummary, upperBoundMinor: number | null): Eligibility['blockers'] {
  if (upperBoundMinor === null) return [issue('cost_unknown', 'Não há limite seguro para o novo gasto.', 'Definir limite superior antes de reservar o job.')];
  const amounts = [costs.confirmed_minor, costs.committed_minor, costs.ceiling_minor, costs.safety_margin_minor, upperBoundMinor];
  if (amounts.some(v => !Number.isSafeInteger(v) || v < 0)) return [issue('cost_invalid', 'Valores monetários inválidos.', 'Reconciliar valores monetários inteiros.')];
  const required = costs.confirmed_minor + costs.committed_minor + costs.safety_margin_minor + upperBoundMinor;
  if (!Number.isSafeInteger(required) || required > costs.ceiling_minor) return [issue('budget_exceeded', 'O gasto excede o saldo seguro disponível.', 'Ajustar teto ou escolher alternativa sem novo gasto.')];
  return [];
}

export function canRetry(job: Job, maxAttempts: number): boolean {
  return job.status === 'failed' && job.error?.retryable === true && job.attempt < maxAttempts;
}

/** Integridade entre entidades; schemas individuais validam a forma e este check valida os vínculos. */
export function inspectDossier(dossier: Dossier, article: Article, profile: Profile): Eligibility['blockers'] {
  const blockers: Eligibility['blockers'] = [];
  const add = (code: string, message: string) => blockers.push(issue(code, message, 'Corrigir o dossiê preservando a versão anterior.'));
  if (!sameRef(dossier.article, article)) add('article_revision_mismatch', 'Dossiê não corresponde à revisão da fonte.');
  if (!sameRef(dossier.profile, profile)) add('profile_revision_mismatch', 'Dossiê não corresponde à revisão do perfil.');
  if (!sameRef(dossier.character, profile.character)) add('character_revision_mismatch', 'Dossiê usa outra identidade.');
  const articleSegments = new Set(article.segments.map(s => s.id));
  const speechIds = new Set<string>();
  const blockIds = new Set<string>();
  const shotIds = new Set<string>();
  for (const block of dossier.blocks) {
    if (blockIds.has(block.id)) add('duplicate_block', `Bloco duplicado: ${block.id}.`);
    blockIds.add(block.id);
    for (const speech of block.speeches) {
      if (speechIds.has(speech.id)) add('duplicate_speech', `Fala duplicada: ${speech.id}.`);
      speechIds.add(speech.id);
      for (const source of speech.sources) {
        if (source.kind === 'article' && (!sameRef(source.document, article) || !articleSegments.has(source.segment_id))) {
          add('source_missing', `Fala ${speech.id} aponta para trecho ou revisão ausente.`);
        }
        if (source.kind === 'approved_editorial') {
          const editorial = dossier.editorial_sources.find(e => sameRef(e.document, source.document) && e.segment_ids.includes(source.segment_id));
          const approval = editorial && dossier.approvals.find(a => sameRef(a, editorial.approval));
          if (!editorial || !approval || approval.status !== 'active' || approval.kind !== 'editorial' || !sameRef(approval.target, source.document)) {
            add('editorial_source_unapproved', `Fala ${speech.id} usa material editorial sem aprovação ativa.`);
          }
        }
      }
    }
  }
  for (const shot of dossier.shots) {
    if (shotIds.has(shot.id)) add('duplicate_shot', `Plano duplicado: ${shot.id}.`);
    shotIds.add(shot.id);
    const block = dossier.blocks.find(b => b.id === shot.block_id);
    if (!block || shot.speech_segment_ids.some(id => !block.speeches.some(s => s.id === id))) add('shot_speech_missing', `Plano ${shot.id} possui bloco/fala inexistente.`);
    if (!profile.permitted_shot_classes.includes(shot.shot_class)) add('shot_class_not_allowed', `Classe do plano ${shot.id} está fora do repertório.`);
    for (const ref of [shot.references.character, shot.references.environment, shot.references.wardrobe, shot.references.style,
      shot.references.composition, ...shot.references.props].filter((r): r is VersionRef => r !== null)) {
      if (!sameRef(ref, profile.character) && !profile.permitted_references.some(p => sameRef(p, ref))) add('reference_not_allowed', `Plano ${shot.id} usa referência não permitida: ${ref.id}:v${ref.version}.`);
    }
    if (shot.status !== 'draft' && shot.duration.target_seconds === null) add('shot_duration_missing', `Plano ${shot.id} não possui duração-alvo.`);
    if (shot.route === 'avatar' && !shot.references.character) add('avatar_identity_missing', `Avatar ${shot.id} exige identidade fixada.`);
  }
  const assetByRef = (ref: VersionRef) => dossier.assets.find(a => sameRef(a, ref));
  for (const asset of dossier.assets) {
    for (const ref of asset.evaluation_refs) {
      const evaluation = dossier.evaluations.find(e => sameRef(e, ref));
      if (!evaluation || !sameRef(evaluation.target, asset)) add('asset_evaluation_missing', `Asset ${asset.id} possui avaliação ausente ou de outra versão.`);
    }
    if (asset.status === 'approved' && !asset.evaluation_refs.some(ref => dossier.evaluations.some(e => sameRef(e, ref) && e.status === 'approved' && sameRef(e.target, asset)))) {
      add('asset_approval_missing', `Asset ${asset.id} não possui avaliação aprovada da versão.`);
    }
  }
  for (const job of dossier.jobs) {
    if (!sameRef(job.production, dossier.production)) add('job_production_mismatch', `Job ${job.id} pertence a outra produção.`);
    if (job.output_assets.some(ref => !assetByRef(ref))) add('job_output_missing', `Job ${job.id} possui asset ausente.`);
  }
  if (dossier.timeline) {
    const timeline = dossier.timeline;
    if (!sameRef(timeline.production, dossier.production)) add('timeline_production_mismatch', 'Timeline pertence a outra produção.');
    for (const segment of [...timeline.audio, ...timeline.video]) {
      const asset = assetByRef(segment.asset);
      if (!asset || asset.status !== 'approved') add('timeline_asset_invalid', 'Timeline usa asset ausente, reprovado ou desatualizado.');
      if (asset?.file.duration_seconds !== null && asset?.file.duration_seconds !== undefined && segment.source_out_seconds > asset.file.duration_seconds) add('timeline_trim_invalid', 'Recorte excede a duração efetiva do asset.');
    }
    if (timeline.audio.some(s => !speechIds.has(s.speech_segment_id)) || timeline.subtitles.some(s => !speechIds.has(s.speech_segment_id))) add('timeline_speech_missing', 'Timeline usa fala inexistente.');
    if (timeline.video.some(s => !dossier.shots.some(p => sameRef(p, s.shot)))) add('timeline_shot_missing', 'Timeline usa plano inexistente.');
  }
  return blockers;
}

export function finalApprovalValid(render: Asset, approval: Approval | null, evaluations: Evaluation[], pendingIssues: Eligibility['blockers']): boolean {
  return render.type === 'render' && render.status === 'approved' && render.usage.permission === 'allowed'
    && approval !== null && approval.kind === 'final' && approval.status === 'active' && approval.reviewed_in_full
    && sameRef(approval.target, render) && !pendingIssues.some(i => i.required)
    && approval.evaluation_refs.length > 0 && approval.evaluation_refs.every(ref => evaluations.some(e => sameRef(e, ref)
      && sameRef(e.target, render) && e.method === 'human' && e.status === 'approved'));
}

export function productionApprovalValid(production: Production, render: Asset, approval: Approval | null, evaluations: Evaluation[]): boolean {
  return production.current_render !== null && sameRef(production.current_render, render)
    && production.current_approval !== null && approval !== null && sameRef(production.current_approval, approval)
    && finalApprovalValid(render, approval, evaluations, production.pending_issues);
}
export * from './retention.js';
export * from './calibration.js';
