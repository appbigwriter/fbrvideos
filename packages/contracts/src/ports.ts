import { z } from 'zod';
import { CONTRACT_VERSION, ErrorSchema, HashSchema, IdSchema, JobSchema, RouteSchema, VersionRefSchema } from './schemas.js';
import type { Asset, Job, VersionRef } from './schemas.js';

export const CreateProductionRequestSchema = z.strictObject({
  contract_version: z.literal(CONTRACT_VERSION), command_id: IdSchema,
  article: VersionRefSchema, profile: VersionRefSchema, name: z.string().min(1),
  mode: z.enum(['calibration', 'recurring']),
  overrides: z.strictObject({ editorial_scope: z.string().min(1).optional(), target_seconds: z.number().positive().optional(),
    preferred_environment: VersionRefSchema.optional(), avoid: z.array(z.string().min(1)).optional(),
    review_script: z.boolean().optional() }).optional(),
});
export const ProductionCommandSchema = z.strictObject({
  command_id: IdSchema, production: VersionRefSchema,
  action: z.enum(['pause', 'resume', 'cancel', 'approve_final']),
  render: VersionRefSchema.optional(), reviewed_in_full: z.boolean().optional(),
}).superRefine((v, ctx) => {
  if (v.action === 'approve_final' && (!v.render || !v.reviewed_in_full)) ctx.addIssue({ code: 'custom', message: 'Aprovação exige render fixado e declaração de revisão integral' });
});
export const AdapterOperationSchema = z.enum(['audio', 'image', 'avatar', 'animation', 'render']);
export const AdapterCapabilitiesSchema = z.strictObject({
  adapter_id: IdSchema, mode: z.enum(['simulated', 'real']), version: z.string().min(1),
  operations: z.array(AdapterOperationSchema), routes: z.array(RouteSchema), accepts_official_audio: z.boolean(), produces_audio: z.boolean(),
  accepts_references: z.boolean(), accepts_composition: z.boolean(), can_query_job: z.boolean(), can_cancel_job: z.boolean(),
  max_clip_seconds: z.number().positive().nullable(), supported_fields: z.array(z.string().min(1)),
  evidence_refs: z.array(z.string().min(1)),
  supports_idempotent_recovery:z.boolean().default(false),
});
export const AdapterRequestSchema = z.strictObject({
  contract_version: z.literal(CONTRACT_VERSION), execution_key: HashSchema, attempt: z.int().positive(),
  production: VersionRefSchema, shot: VersionRefSchema.nullable(), operation: AdapterOperationSchema, route: RouteSchema.nullable(),
  input_assets: z.array(VersionRefSchema), references: z.array(VersionRefSchema),
  configuration_hash: HashSchema, parameters: z.record(z.string().min(1), z.json()),
  currency: z.string().regex(/^[A-Z]{3}$/), reserved_minor: z.int().nonnegative(),
}).superRefine((v, ctx) => {
  if (['image', 'avatar', 'animation'].includes(v.operation) && (!v.shot || !v.route)) ctx.addIssue({ code: 'custom', message: 'Operação visual exige plano e rota' });
  if (['audio', 'render'].includes(v.operation) && v.route !== null) ctx.addIssue({ code: 'custom', message: 'Áudio e render não possuem rota visual' });
  if (v.operation === 'avatar' && v.route !== 'avatar') ctx.addIssue({ code: 'custom', message: 'Avatar exige rota avatar' });
  if (v.operation === 'animation' && v.route !== 'animated_scene') ctx.addIssue({ code: 'custom', message: 'Animação exige rota animated_scene' });
});
export const AdapterResultSchema = z.discriminatedUnion('outcome', [
  z.strictObject({ outcome: z.literal('accepted'), job: JobSchema }),
  z.strictObject({ outcome: z.literal('blocked'), error: ErrorSchema }),
]);
export type AdapterCapabilities = z.infer<typeof AdapterCapabilitiesSchema>;
export type AdapterRequest = z.infer<typeof AdapterRequestSchema>;
export type AdapterResult = z.infer<typeof AdapterResultSchema>;

// A/C importam só a fronteira pública; SDK, banco e prompts ficam nos respectivos pacotes.
export interface GenerationAdapter {
  capabilities(): Promise<AdapterCapabilities>;
  submit(request: AdapterRequest): Promise<AdapterResult>;
  query(externalJobId: string): Promise<AdapterResult>;
  cancel(externalJobId: string): Promise<AdapterResult>;
  recover?(request:AdapterRequest):Promise<AdapterResult>;
}
export interface ImmutableRepository<T extends VersionRef> {
  get(ref: VersionRef): Promise<T | null>;
  append(record: T, expectedPreviousVersion: number | null): Promise<void>;
}
export interface JobRepository extends ImmutableRepository<Job> {
  findValidResult(executionKey: string): Promise<Job | null>;
}
export interface AssetStore {
  putImmutable(storageKey: string, bytes: Uint8Array, expectedHash: string): Promise<void>;
  read(storageKey: string): Promise<Uint8Array>;
  exists(asset: Asset): Promise<boolean>;
}
