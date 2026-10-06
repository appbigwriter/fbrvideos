import {z} from 'zod';
import {IdSchema,VersionRefSchema,HashSchema} from './schemas.js';
import {GenerationIntentSchema} from './generation-queue.js';
export const CorrectionExecutionPlanSchema=z.strictObject({id:IdSchema,correction:VersionRefSchema,production:VersionRefSchema,
  dossier:VersionRefSchema,roots:z.array(VersionRefSchema).min(1),intents:z.array(GenerationIntentSchema).min(1),hash:HashSchema});
export type CorrectionExecutionPlan=z.infer<typeof CorrectionExecutionPlanSchema>;
export const AuthorizeCorrectionSchema=z.strictObject({command_id:IdSchema,production:VersionRefSchema,correction:VersionRefSchema,
  plan_hash:HashSchema,maximum_minor:z.int().nonnegative()});
export const ExecuteCorrectionSchema=z.strictObject({command_id:IdSchema,production:VersionRefSchema,correction:VersionRefSchema,plan_hash:HashSchema});
export const PublishCorrectionAssetsSchema=z.strictObject({command_id:IdSchema,production:VersionRefSchema,correction:VersionRefSchema,
  replacements:z.array(z.strictObject({previous:VersionRefSchema,next:VersionRefSchema})).min(1)});
