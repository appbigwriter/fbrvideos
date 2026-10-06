import { z } from 'zod';
import { VersionRefSchema, IssueSchema, DossierSchema, ArticleSchema } from './schemas.js';
import type { SelectOption } from './configuration-ui.js';

export const ProductionSummarySchema=z.strictObject({article:z.strictObject({ref:VersionRefSchema,title:z.string().min(1)}),
  profile:z.strictObject({ref:VersionRefSchema,name:z.string().min(1)}).nullable(),
  mode:z.enum(['calibration','recurring']),budget_label:z.string().min(1).nullable(),
  estimate_label:z.string().min(1),blockers:z.array(IssueSchema),can_submit:z.boolean()});
export const DossierPresentationSchema=z.strictObject({dossier:DossierSchema,article:ArticleSchema,
  notice:z.string().min(1)}).refine(v=>v.dossier.article.id===v.article.id&&v.dossier.article.version===v.article.version,
    {message:'A apresentação exige a revisão exata do artigo fonte.'});
export type ProductionSummary=z.infer<typeof ProductionSummarySchema>;
export type DossierPresentation=z.infer<typeof DossierPresentationSchema>;
export interface ProductionSummaryProps {data:ProductionSummary|null;loading:boolean;error:string|null;onRetry():void;}
export interface ProductionOptionsProps {
  name:string;profile_value:string;profile_options:readonly SelectOption[];mode:'calibration'|'recurring';
  target_seconds:string;avoid:string;pending:boolean;error:string|null;
  onNameChange(value:string):void;onProfileChange(value:string):void;
  onModeChange(value:'calibration'|'recurring'):void;onTargetSecondsChange(value:string):void;onAvoidChange(value:string):void;
}
export interface DossierPanelProps {data:DossierPresentation|null;loading:boolean;error:string|null;onRetry():void;}
export interface NarrativeBlocksProps {data:DossierPresentation;}
export interface ShotDetailsProps {shot:DossierPresentation['dossier']['shots'][number];}
