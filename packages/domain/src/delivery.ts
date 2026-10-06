import { ExportManifestSchema, ProductionSchema, DossierSchema, type Production, type Dossier,
  type ExportManifest, type VersionRef } from '@fbr/contracts';
import { sameRef, productionApprovalValid } from './index.js';
import { canonical, sha256 } from './configuration.js';

/** Manifesto estável da revisão selecionada; preview e entrega aprovada têm políticas distintas. */
export function buildDeliveryManifest(rawProduction: Production, rawDossier: Dossier,
  mode: 'preview' | 'approved_delivery', subtitleRefs: VersionRef[] = []): ExportManifest {
  const production = ProductionSchema.parse(rawProduction), dossier = DossierSchema.parse(rawDossier);
  if (!production.dossier || !sameRef(production.dossier, dossier) || dossier.production.id !== production.id
    || !sameRef(production.article, dossier.article) || !sameRef(production.profile, dossier.profile)
    || !sameRef(production.character, dossier.character) || !dossier.timeline
    || dossier.timeline.status !== 'rendered' || dossier.timeline.production.id !== production.id)
    throw new Error('delivery_revision_mismatch');
  const timeline = dossier.timeline;
  const render = dossier.assets.find(asset => production.current_render && sameRef(asset, production.current_render));
  if (!render || render.type !== 'render' || ['outdated', 'rejected'].includes(render.status)
    || !sameRef(render.specification, timeline)) throw new Error('delivery_render_missing_or_outdated');
  const issues = [...production.pending_issues, ...dossier.pending_issues];
  const approval = dossier.approvals.find(value => production.current_approval && sameRef(value, production.current_approval)) ?? null;
  if (mode === 'approved_delivery' && (!['approved', 'exported'].includes(production.status)
    || issues.some(issue => issue.required) || production.costs.committed_minor !== 0
    || dossier.jobs.some(job => ['queued', 'running', 'unknown'].includes(job.status) || job.costs.confirmed_minor === null)
    || !productionApprovalValid(production, render, approval, dossier.evaluations)))
    throw new Error('delivery_final_approval_required');
  if (new Set(subtitleRefs.map(ref => `${ref.id}:${ref.version}`)).size !== subtitleRefs.length) throw new Error('delivery_subtitle_duplicate');
  const subtitles = subtitleRefs.map(ref => {
    const asset = dossier.assets.find(asset => sameRef(asset, ref));
    if (!asset || asset.type !== 'subtitle' || !sameRef(asset.specification, timeline)
      || ['outdated','rejected'].includes(asset.status) || asset.usage.permission !== 'allowed'
      || !['text/vtt','application/x-subrip'].includes(asset.file.mime_type)) throw new Error('delivery_subtitle_revision_mismatch');
    return asset;
  });
  const body = { status: mode, contract_version: '0.1.0', production: { id: production.id, version: production.version },
    article: production.article, profile: production.profile, render: { id: render.id, version: render.version },
    approval: mode === 'approved_delivery' ? approval : null, pending_issues: issues,
    delivery: timeline.delivery, assets: [render, ...subtitles], costs: production.costs };
  return ExportManifestSchema.parse({ ...body, id: `export_${sha256(canonical(body))}`, version: 1,
    created_at: production.created_at, author: 'local_delivery', changes: [] });
}
