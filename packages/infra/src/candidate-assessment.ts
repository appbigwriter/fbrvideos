import {z} from 'zod';
import {EvaluationSchema,type Asset,type GenerationExecution,type ProductionSnapshot} from '@fbr/contracts';
import type {PipelineOperationContext} from './production-pipeline.js';

/** A server-side evaluator supplies evidence; probing a file alone never proves visual quality. */
export const CandidateAssessmentSchema=z.strictObject({
  criteria:EvaluationSchema.shape.criteria,
  retryable:z.boolean(),
});
export type CandidateAssessment=z.infer<typeof CandidateAssessmentSchema>;
export interface CandidateAssessor{
  id:string;
  version:string;
  evaluate(input:{asset:Asset;execution:GenerationExecution;context:PipelineOperationContext;policy:NonNullable<ProductionSnapshot['profile']['execution_policy']>}):Promise<CandidateAssessment>;
}

export function assessmentDecision(assessment:CandidateAssessment,requiredChecks:string[],rightsAllowed:boolean){
  const checks=CandidateAssessmentSchema.parse(assessment).criteria;
  if(!rightsAllowed||requiredChecks.some(name=>checks.filter(c=>c.name===name).length!==1))return 'needs_review' as const;
  const required=checks.filter(c=>c.mandatory||requiredChecks.includes(c.name));
  if(required.some(c=>c.result==='fail'))return 'rejected' as const;
  if(required.some(c=>c.result!=='pass'))return 'needs_review' as const;
  return 'approved' as const;
}
