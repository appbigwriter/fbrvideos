import { z } from 'zod';
import { ArticleSchema, ProfileSchema, CharacterSchema, ReferenceSchema, ProductionSchema, DossierSchema,
  VersionRefSchema, TimestampSchema, IdSchema, HashSchema, IssueSchema } from './schemas.js';
import { CreateProductionRequestSchema } from './ports.js';
import { PipelineCatalogSchema } from './pipeline-catalog.js';
export const ProductionSnapshotSchema = z.strictObject({
  production_id: IdSchema, captured_at: TimestampSchema, hash: HashSchema,
  request: CreateProductionRequestSchema, article: ArticleSchema, profile: ProfileSchema,
  character: CharacterSchema, references: z.array(ReferenceSchema), bible_original: z.string().min(1), catalog: PipelineCatalogSchema,
});
export const ProductionEventSchema = z.strictObject({ id: IdSchema, production: VersionRefSchema,
  at: TimestampSchema, type: z.enum(['created','paused','resumed','cancelled','planning_started','planning_completed','planning_failed','costs_updated',
    'review_point_created','review_point_resolved','final_approved','exported','correction_proposed','correction_cancelled','assembly_completed','speech_edited','correction_estimated','correction_authorized','correction_started','correction_completed','planning_approved','generation_started','generation_updated']),
  message: z.string().min(1) });
export const ProductionDetailSchema = z.strictObject({ production: ProductionSchema, snapshot: ProductionSnapshotSchema,
  dossier: DossierSchema.nullable(), events: z.array(ProductionEventSchema),
  actions: z.strictObject({ pause: z.boolean(), resume: z.boolean(), cancel: z.boolean() }),
});
export const ProductionsListSchema = z.strictObject({ items: z.array(ProductionSchema) });
export const PlanningCommandSchema = z.strictObject({ command_id: IdSchema, production: VersionRefSchema,
  action: z.enum(['planning_started','planning_completed','planning_failed']), dossier: DossierSchema.optional(),
  issues: z.array(IssueSchema).optional() }).superRefine((value,ctx)=>{
    if(value.action==='planning_completed'&&!value.dossier)ctx.addIssue({code:'custom',message:'Conclusão exige dossiê.'});
    if(value.action!=='planning_completed'&&value.dossier)ctx.addIssue({code:'custom',message:'Dossiê somente na conclusão.'});
    if(value.action!=='planning_failed'&&value.issues)ctx.addIssue({code:'custom',message:'Diagnóstico somente na falha.'});
  });
export type ProductionSnapshot = z.infer<typeof ProductionSnapshotSchema>;
export type ProductionEvent = z.infer<typeof ProductionEventSchema>;
export type ProductionDetail = z.infer<typeof ProductionDetailSchema>;
