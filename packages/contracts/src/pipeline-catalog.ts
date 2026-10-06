import { z } from 'zod';
import { CONTRACT_VERSION, IdSchema, RouteSchema, ShotClassSchema } from './schemas.js';
import { AdapterOperationSchema } from './ports.js';

export const ParameterRuleSchema = z.strictObject({
  name: z.string().min(1), type: z.enum(['string', 'number', 'integer', 'boolean']), required: z.boolean(),
  nullable: z.boolean().default(false), minimum: z.number().nullable().default(null), maximum: z.number().nullable().default(null),
  choices: z.array(z.union([z.string(), z.number(), z.boolean()])).default([]),
});
export const ModelOperationSchema = z.strictObject({
  id: IdSchema, provider: z.string().min(1), model: z.string().min(1), operation: AdapterOperationSchema,
  route: RouteSchema.nullable(), documentation: z.enum(['schema_reviewed', 'catalog_only', 'unknown']),
  documentation_url: z.url().nullable(), reviewed_on: z.iso.date(), account_access: z.enum(['unverified', 'verified', 'denied']),
  runtime: z.enum(['not_implemented', 'simulated', 'real']),
  official_audio: z.enum(['supported', 'unsupported', 'unknown']), references: z.enum(['supported', 'unsupported', 'unknown']),
  composition: z.enum(['supported', 'unsupported', 'unknown']),
  minimum_seconds: z.number().positive().nullable(), maximum_seconds: z.number().positive().nullable(),
  parameters: z.array(ParameterRuleSchema), required_inputs: z.array(z.enum(['official_audio', 'image', 'identity', 'timeline'])),
  evidence_refs: z.array(z.string().min(1)), notes: z.array(z.string().min(1)),
});
export const ShotClassDefinitionSchema = z.strictObject({
  id: ShotClassSchema, label: z.string().min(1), routes: z.array(RouteSchema).min(1),
  required_reference_kinds: z.array(z.enum(['character', 'environment', 'wardrobe', 'prop', 'style', 'voice', 'composition'])),
  fallbacks: z.array(z.strictObject({ shot_class: ShotClassSchema, route: RouteSchema, requires_direction_review: z.boolean() })),
  constraints: z.array(z.string().min(1)),
});
export const RecipeSchema = z.strictObject({
  id: IdSchema, version: z.int().positive(), label: z.string().min(1), article_classes: z.array(z.string().min(1)).min(1),
  state: z.enum(['candidate', 'experimental']), requires_source_personal_account: z.boolean(),
  sections: z.array(z.strictObject({ role: z.string().min(1), shot_classes: z.array(ShotClassSchema).min(1) })).min(1),
});
// Somente o registro de evidência revisado no servidor pode alimentar este escopo; não há endpoint de aprovação.
export const CalibrationEvidenceSchema = z.strictObject({
  profile: z.strictObject({ id: IdSchema, version: z.int().positive() }), recipe: IdSchema, recipe_version: z.int().positive(),
  model_operation: IdSchema, shot_classes: z.array(ShotClassSchema), article_classes: z.array(z.string().min(1)).min(1),
  formats: z.array(z.string().min(1)).min(1), evidence_refs: z.array(z.string().min(1)).min(1),
});
export const PipelineCatalogSchema = z.strictObject({ contract_version: z.literal(CONTRACT_VERSION), version: z.string().min(1),
  recipes: z.array(RecipeSchema), shot_classes: z.array(ShotClassDefinitionSchema), models: z.array(ModelOperationSchema),
  calibrations: z.array(CalibrationEvidenceSchema),
});
export type ModelOperation = z.infer<typeof ModelOperationSchema>;
export type PipelineCatalog = z.infer<typeof PipelineCatalogSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export const AudiovisualCheckRequestSchema = z.strictObject({
  profile_version: z.int().positive(), article: z.strictObject({ id: IdSchema, version: z.int().positive() }),
  mode: z.enum(['calibration','recurring']), article_class: z.string().min(1).max(100), format: z.string().min(1).max(100),
  model_operations: z.array(IdSchema).max(20),
});
export type AudiovisualCheckRequest = z.infer<typeof AudiovisualCheckRequestSchema>;
