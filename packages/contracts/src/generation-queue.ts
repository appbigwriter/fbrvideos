import { z } from 'zod';
import { AdapterRequestSchema, AdapterOperationSchema } from './ports.js';
import { IdSchema, MoneySchema, JobSchema, TimestampSchema, VersionRefSchema,type Production } from './schemas.js';

export const GenerationIntentSchema = z.strictObject({
  adapter_id: IdSchema, request: AdapterRequestSchema,
  estimate: z.strictObject({ currency: z.string().regex(/^[A-Z]{3}$/), upper_minor: MoneySchema,
    evidence: z.string().trim().min(1) }),
}).superRefine((v, ctx) => {
  if (v.estimate.currency !== v.request.currency || v.estimate.upper_minor !== v.request.reserved_minor)
    ctx.addIssue({ code: 'custom', message: 'Reserva exige estimativa na mesma moeda e valor.' });
});
export const GenerationExecutionSchema = z.strictObject({
  id: IdSchema, version: z.int().positive(), intent: GenerationIntentSchema,
  state: z.enum(['prepared', 'submitting', 'active', 'unknown', 'succeeded', 'failed', 'cancelled']),
  reserved_minor: MoneySchema, confirmed_minor: MoneySchema,
  provider_job: JobSchema.nullable(), diagnostic: z.string().nullable(),
  lease_token: IdSchema.nullable(), lease_until: TimestampSchema.nullable(),
});
export type GenerationIntent = z.infer<typeof GenerationIntentSchema>;
export type GenerationExecution = z.infer<typeof GenerationExecutionSchema>;
/** Política server-side provisionável; ausência mantém adapters reais fechados. */
export interface GenerationAdmissionContext{quote(adapterId:string,executionKey:string,attempt:number):Promise<unknown>}
export type GenerationAdmission=(intent:GenerationIntent,production:Production,context?:GenerationAdmissionContext)=>Promise<boolean>;
export const GenerationSummarySchema = z.strictObject({
  ref: VersionRefSchema, production: VersionRefSchema, operation: AdapterOperationSchema,
  state: GenerationExecutionSchema.shape.state, attempt: z.int().positive(), simulated: z.boolean(),
  costs: z.strictObject({ currency: z.string().regex(/^[A-Z]{3}$/), estimated_minor: MoneySchema,
    committed_minor: MoneySchema, confirmed_minor: MoneySchema }),
  message: z.string().min(1).nullable(),
});
export const GenerationListSchema = z.strictObject({ items: z.array(GenerationSummarySchema) });
export interface GenerationQueue {
  enqueue(raw: unknown): Promise<GenerationExecution>;
  get(id: string): Promise<GenerationExecution | null>;
  list(productionId: string): Promise<GenerationExecution[]>;
  claim(id: string, leaseSeconds?: number,allowIdempotentRecovery?:boolean): Promise<GenerationExecution | null>;
  complete(id: string, token: string, job: unknown): Promise<GenerationExecution>;
  uncertain(id: string, token: string, diagnostic: string): Promise<GenerationExecution>;
  cancelPrepared(id: string): Promise<GenerationExecution>;
}
