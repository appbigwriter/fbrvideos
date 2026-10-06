import { DossierSchema, VersionRefSchema, type Dossier, type VersionRef, type Correction } from '@fbr/contracts';
import { sameRef } from './index.js';

export interface DependencyNode { ref: VersionRef; dependencies: VersionRef[] }
const key = (ref: VersionRef) => `${ref.id}:${ref.version}`;

/** Nós sempre usam revisões exatas; referências externas são folhas, nunca versões atuais do cadastro. */
export function dossierDependencies(raw: Dossier): DependencyNode[] {
  const dossier = DossierSchema.parse(raw), nodes = new Map<string, DependencyNode>();
  const leaf = (record: VersionRef) => {
    const ref = VersionRefSchema.parse({ id: record.id, version: record.version });
    if (!nodes.has(key(ref))) nodes.set(key(ref), { ref, dependencies: [] });
  };
  const add = (ref: VersionRef, dependencies: VersionRef[]) => {
    leaf(ref); dependencies.forEach(leaf);
    const node = nodes.get(key(ref))!;
    for (const dependency of dependencies) if (!node.dependencies.some(value => sameRef(value, dependency)))
      node.dependencies.push({ id: dependency.id, version: dependency.version });
  };
  add(dossier, [dossier.article, dossier.profile, dossier.character]);
  for (const shot of dossier.shots) add(shot, [dossier, ...shot.dependencies,
    ...[shot.references.character, shot.references.environment, shot.references.wardrobe, shot.references.style,
      shot.references.composition, ...shot.references.props].filter((ref): ref is VersionRef => ref !== null)]);
  for (const job of dossier.jobs) add(job, job.inputs);
  for (const asset of dossier.assets) add(asset, [asset.specification, ...asset.references, ...(asset.execution ? [asset.execution] : []),
    ...(asset.type==='audio'&&asset.specification.id===dossier.id?[{id:dossier.id,version:dossier.version}]:[])]);
  if (dossier.timeline) add(dossier.timeline, [...dossier.timeline.audio.map(segment => segment.asset),
    ...dossier.timeline.video.flatMap(segment => [segment.asset, segment.shot]), ...dossier.timeline.music.map(segment => segment.asset)]);
  for (const evaluation of dossier.evaluations) add(evaluation, [evaluation.target]);
  for (const approval of dossier.approvals) add(approval, [approval.target, ...approval.evaluation_refs]);
  return [...nodes.values()];
}
export function dependencyImpact(nodes: DependencyNode[], roots: VersionRef[]) {
  const graph = new Map<string, DependencyNode>();
  for (const node of nodes) {
    VersionRefSchema.parse(node.ref); node.dependencies.forEach(ref => VersionRefSchema.parse(ref));
    if (graph.has(key(node.ref))) throw new Error('dependency_node_duplicate');
    graph.set(key(node.ref), node);
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error('dependency_cycle');
    if (visited.has(id)) return;
    const node = graph.get(id); if (!node) throw new Error('dependency_node_missing');
    visiting.add(id); node.dependencies.forEach(ref => visit(key(ref))); visiting.delete(id); visited.add(id);
  };
  graph.forEach((_node, id) => visit(id));
  const invalidated = new Set<string>();
  for (const root of roots) {
    VersionRefSchema.parse(root); if (!graph.has(key(root))) throw new Error('dependency_root_missing');
    invalidated.add(key(root));
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, node] of graph) if (!invalidated.has(id) && node.dependencies.some(ref => invalidated.has(key(ref)))) {
      invalidated.add(id); changed = true;
    }
  }
  return { invalidated: nodes.filter(node => invalidated.has(key(node.ref))).map(node => ({ id: node.ref.id, version: node.ref.version })),
    preserved: nodes.filter(node => !invalidated.has(key(node.ref))).map(node => ({ id: node.ref.id, version: node.ref.version })) };
}
export function correctionImpact(raw: Dossier, roots: VersionRef[]): Correction['impact'] {
  if (!roots.length) throw new Error('dependency_roots_required');
  const dossier = DossierSchema.parse(raw), impact = dependencyImpact(dossierDependencies(dossier), roots);
  return { ...impact, approval_invalidated: dossier.approvals.some(approval => approval.status === 'active' && approval.kind === 'final'
    && impact.invalidated.some(ref => sameRef(ref, approval) || sameRef(ref, approval.target))) };
}
/** Cria uma revisão de planejamento; os records anteriores e avaliações permanecem como evidência. */
export function invalidateDossier(raw: Dossier, roots: VersionRef[]): Dossier {
  const dossier = DossierSchema.parse(raw), impact = correctionImpact(dossier, roots);
  const invalid = (ref: VersionRef) => impact.invalidated.some(value => sameRef(value, ref));
  const at = new Date().toISOString();
  const revision = <T extends { version: number; created_at: string; changes: { at: string; author: string; reason: string }[] }>(record: T) => ({
    ...record, version: record.version + 1, created_at: at,
    changes: [...record.changes, { at, author: 'dependency_graph', reason: 'Derivado invalidado por correção; revisão anterior preservada.' }] });
  return DossierSchema.parse({ ...dossier, version: dossier.version + 1, status: 'outdated', created_at: at,
    changes: [...dossier.changes, { at, author: 'dependency_graph', reason: 'Correção invalida derivados por revisão; histórico preservado.' }],
    shots:dossier.shots.map(shot=>invalid(shot)?{...revision(shot),status:'specified'}:shot),
    assets: dossier.assets.map(asset => invalid(asset) ? { ...revision(asset), status: 'outdated' } : asset),
    timeline: dossier.timeline && invalid(dossier.timeline) ? { ...revision(dossier.timeline), status: 'outdated' } : dossier.timeline,
    approvals: dossier.approvals.map(approval => invalid(approval) ? { ...revision(approval), status: 'invalidated' } : approval),
    pending_issues: [...dossier.pending_issues, { code: 'correction_dependencies_outdated', message: 'Há derivados invalidados pela correção.',
      next_action: 'Autorizar o plano de custo e regenerar os derivados afetados antes de revisar a nova montagem.', required: true }] });
}
