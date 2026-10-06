import { z } from 'zod';
import { ApprovalSchema, AssetSchema, CorrectionSchema, CostSummarySchema, EligibilitySchema, IssueSchema,
  ProductionStageSchema, ProductionStateSchema, VersionRefSchema } from './schemas.js';

export const navigation = [
  { label: 'Início', path: '/' }, { label: 'Artigos', path: '/artigos' },
  { label: 'Produções', path: '/producoes' }, { label: 'Perfis de produção', path: '/perfis' },
  { label: 'Universo', path: '/universo' }, { label: 'Configurações', path: '/configuracoes' },
] as const;
export const routePaths = { home: '/', articles: '/artigos', article: '/artigos/:id',
  productions: '/producoes', createProduction: '/producoes/nova', production: '/producoes/:id',
  review: '/producoes/:id/revisao', delivery: '/producoes/:id/entrega', profiles: '/perfis',
  universe: '/universo', settings: '/configuracoes' } as const;
export const productionStateLabels = { preparing: 'Em preparação', producing: 'Em produção',
  awaiting_decision: 'Aguardando decisão', paused: 'Pausada', failed: 'Falhou', ready_for_review: 'Pronta para revisão',
  correcting: 'Em correção', approved: 'Aprovada', exported: 'Exportada', cancelled: 'Cancelada' } as const;

export const ActionAvailabilitySchema = z.strictObject({ enabled: z.boolean(), reason: z.string().min(1).nullable() })
  .refine(v => v.enabled || v.reason !== null, { message: 'Ação indisponível exige motivo' });
export const ArticleSummarySchema = z.strictObject({ ref: VersionRefSchema, title: z.string().min(1),
  source_author: z.string().min(1), character: VersionRefSchema.nullable(), eligibility: EligibilitySchema });
export const ProfileSummarySchema = z.strictObject({ ref: VersionRefSchema, name: z.string().min(1),
  status: z.enum(['draft', 'calibrating', 'validated', 'suspended']), eligibility: EligibilitySchema });
export const ProductionViewSchema = z.strictObject({
  ref: VersionRefSchema, name: z.string().min(1), status: ProductionStateSchema, stage: ProductionStageSchema,
  article: ArticleSummarySchema, profile: ProfileSummarySchema, costs: CostSummarySchema,
  pending_issues: z.array(IssueSchema), current_render: AssetSchema.nullable(), current_approval: ApprovalSchema.nullable(),
  correction: CorrectionSchema.nullable(),
  actions: z.strictObject({ generate: ActionAvailabilitySchema, pause: ActionAvailabilitySchema,
    resume: ActionAvailabilitySchema, cancel: ActionAvailabilitySchema, correct: ActionAvailabilitySchema,
    approve: ActionAvailabilitySchema, export: ActionAvailabilitySchema }),
  export: z.strictObject({ available: z.boolean(), kind: z.enum(['preview', 'approved_delivery']).nullable(),
    render: VersionRefSchema.nullable(), files: z.array(z.strictObject({ asset: VersionRefSchema,
      label: z.string().min(1), download_action: z.string().min(1) })) }),
}).superRefine((v, ctx) => {
  if (v.current_render && v.current_render.type !== 'render') ctx.addIssue({ code: 'custom', message: 'Render atual deve ser um asset do tipo render' });
  if (v.actions.approve.enabled && (!v.current_render || v.pending_issues.some(i => i.required))) {
    ctx.addIssue({ code: 'custom', message: 'Aprovação exige render e ausência de pendência obrigatória' });
  }
  if (v.export.available && v.export.kind === null) ctx.addIssue({ code: 'custom', message: 'Exportação disponível deve identificar preview ou entrega aprovada' });
  if (v.export.available && (!v.export.render || !v.current_render || v.export.render.id !== v.current_render.id
      || v.export.render.version !== v.current_render.version)) ctx.addIssue({ code: 'custom', message: 'Exportação deve apontar para o render atual' });
  if (v.export.available && v.export.kind === 'approved_delivery'
      && (!v.current_approval || v.current_approval.kind !== 'final' || v.current_approval.status !== 'active'
      || !v.current_render || v.current_approval.target.id !== v.current_render.id
      || v.current_approval.target.version !== v.current_render.version || v.pending_issues.some(i => i.required))) {
    ctx.addIssue({ code: 'custom', message: 'Entrega aprovada exige aprovação ativa do render exato' });
  }
  if (v.actions.export.enabled && (!v.export.available || v.export.kind !== 'approved_delivery')) {
    ctx.addIssue({ code: 'custom', message: 'Ação de entrega aprovada exige exportação aprovada disponível; preview é ação separada' });
  }
});
export type ProductionView = z.infer<typeof ProductionViewSchema>;
