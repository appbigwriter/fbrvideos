import { z } from 'zod';
import { VersionRefSchema, HashSchema, TimestampSchema, IdSchema, ProductionStateSchema, CostSummarySchema, CorrectionSchema,SpeechSchema } from './schemas.js';
import { ActionAvailabilitySchema } from './presentation.js';
export const ReviewCategorySchema = z.enum(['image_mismatch','identity','environment','motion','speech_voice','comment']);
export const ReviewPointSchema = z.strictObject({
  id: IdSchema, version: z.int().positive(), created_at: TimestampSchema, production: VersionRefSchema,
  render: VersionRefSchema, render_hash: HashSchema, shot: VersionRefSchema.nullable(),
  at_seconds: z.number().nonnegative(), category: ReviewCategorySchema, comment: z.string().trim().min(1).max(4000),
  status: z.enum(['open','dismissed','addressed']), resolution: z.string().trim().min(1).nullable(),
  reviewer: IdSchema,
});
export const CreateReviewPointSchema = z.strictObject({ command_id: IdSchema, production: VersionRefSchema,
  render: VersionRefSchema, render_hash: HashSchema, shot: VersionRefSchema.nullable(),
  at_seconds: z.number().nonnegative(), category: ReviewCategorySchema, comment: z.string().trim().min(1).max(4000) });
export const ResolveReviewPointSchema = z.strictObject({ command_id: IdSchema, production: VersionRefSchema,
  point: VersionRefSchema, status: z.enum(['dismissed','addressed']), reason: z.string().trim().min(1).max(4000) });
export const ApproveReviewSchema = z.strictObject({ command_id: IdSchema, production: VersionRefSchema,
  render: VersionRefSchema, render_hash: HashSchema, reviewed_in_full: z.literal(true) });
export const ReviewSceneSchema = z.strictObject({ ref: VersionRefSchema, title: z.string().min(1),
  start_seconds: z.number().nonnegative(), end_seconds: z.number().positive(), transcript: z.string(),
}).refine(v => v.end_seconds > v.start_seconds, { message:'Intervalo de cena inválido.' });
export const ReviewViewSchema = z.strictObject({ production: VersionRefSchema, name: z.string().min(1), status: ProductionStateSchema,
  render: z.strictObject({ ref: VersionRefSchema, hash: HashSchema, preview_url: z.string().startsWith('/api/productions/'),
    duration_seconds: z.number().positive() }).nullable(),
  scenes: z.array(ReviewSceneSchema), points: z.array(ReviewPointSchema),
  corrections: z.array(CorrectionSchema).default([]),
  correction_plans:z.array(z.strictObject({correction_id:IdSchema,hash:HashSchema})).default([]),
  actions: z.strictObject({ comment: ActionAvailabilitySchema, approve: ActionAvailabilitySchema }),
  notice: z.string().min(1),
});
export const DeliveryViewSchema = z.strictObject({ production: VersionRefSchema, name: z.string().min(1), status: ProductionStateSchema,
  kind: z.enum(['unavailable','preview','approved_delivery']), render: VersionRefSchema.nullable(),
  render_hash: HashSchema.nullable(),
  files: z.array(z.strictObject({ ref: VersionRefSchema, label: z.string().min(1), download_url: z.string().startsWith('/api/productions/') })),
  costs: CostSummarySchema, export_action: ActionAvailabilitySchema, notice: z.string().min(1),
});
export const ExportDeliverySchema = z.strictObject({ command_id: IdSchema, production: VersionRefSchema, render: VersionRefSchema, render_hash: HashSchema });
export const ProposeCorrectionSchema = z.strictObject({command_id:IdSchema,production:VersionRefSchema,point:VersionRefSchema});
export const CancelCorrectionSchema = z.strictObject({command_id:IdSchema,production:VersionRefSchema,correction:VersionRefSchema,reason:z.string().trim().min(1).max(4000)});
export type ReviewPoint = z.infer<typeof ReviewPointSchema>;
export type ReviewView = z.infer<typeof ReviewViewSchema>;
export type ReviewScene = z.infer<typeof ReviewSceneSchema>;
export type DeliveryView = z.infer<typeof DeliveryViewSchema>;
export const RenderHistorySchema=z.strictObject({items:z.array(z.strictObject({production:VersionRefSchema,dossier:VersionRefSchema,
  render:VersionRefSchema,hash:HashSchema,created_at:TimestampSchema,current:z.boolean(),available:z.boolean(),
  preview_url:z.string().startsWith('/api/productions/'),scenes:z.array(ReviewSceneSchema)}))});
export const SpeechEditViewSchema=z.strictObject({production:VersionRefSchema,dossier:VersionRefSchema.nullable(),speeches:z.array(SpeechSchema),
  enabled:z.boolean(),notice:z.string().min(1)});
export const EditSpeechSchema=z.strictObject({command_id:IdSchema,production:VersionRefSchema,dossier:VersionRefSchema,
  speech_id:IdSchema,text:z.string().trim().min(1).max(12000),reason:z.string().trim().min(1).max(4000),source_reviewed:z.literal(true)});
export const ApprovePlanningSchema=z.strictObject({command_id:IdSchema,production:VersionRefSchema,dossier:VersionRefSchema,
  reviewed_sources:z.literal(true),reviewed_direction:z.literal(true)});
export interface SceneReviewPanelProps {
  data: ReviewView|null; loading: boolean; error: string|null; pending: boolean; command_error: string|null;
  selected_shot: z.infer<typeof VersionRefSchema>|null; current_seconds: number;
  category: z.infer<typeof ReviewCategorySchema>; comment: string; can_submit: boolean; submit_reason: string|null;
  onRetry(): void; onSelectShot(ref:z.infer<typeof VersionRefSchema>): void;
  onCategoryChange(value:z.infer<typeof ReviewCategorySchema>): void; onCommentChange(value:string): void; onSubmit(): void;
}
export interface DeliveryPanelProps { data: DeliveryView|null; loading:boolean;error:string|null;pending:boolean;command_error:string|null;onRetry():void;onExport():void }
