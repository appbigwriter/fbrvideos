import { z } from 'zod';
import { DossierSchema,NarrativeBlockSchema,ShotPlanSchema,IdSchema } from './schemas.js';
export const SemanticPlanSchema=z.strictObject({recipe:IdSchema,briefing:DossierSchema.shape.briefing,
  blocks:z.array(NarrativeBlockSchema).min(1).max(40),
  shots:z.array(ShotPlanSchema.omit({version:true,created_at:true,author:true,changes:true,status:true})).min(1).max(80),
  personal_attributions:z.array(z.strictObject({speech_id:IdSchema,segment_id:IdSchema,
    quote:z.string().min(1),speaker:z.enum(['article_author','third_party','ambiguous'])}))});
export const SemanticReviewSchema=z.strictObject({result:z.enum(['pass','reject']),
  findings:z.array(z.strictObject({code:z.string().min(1),message:z.string().min(1),speech_id:IdSchema.nullable()})),
  source_coverage:z.array(IdSchema)});
export interface InferenceResult {value:unknown;usage:{input_tokens:number;output_tokens:number};reused?:boolean;source_execution_key?:string;}
export interface JsonInference {run(prompt:string,schema:Record<string,unknown>):Promise<InferenceResult>;}
export interface InferenceJournal {run(key:string,fingerprint:string,infer:()=>Promise<InferenceResult>):Promise<InferenceResult>;}
