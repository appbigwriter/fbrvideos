import {z} from 'zod';
import {IdSchema,VersionRefSchema,MoneySchema} from '@fbr/contracts';
export const CalibrationObservationSchema=z.strictObject({production:VersionRefSchema,profile:VersionRefSchema,article_class:IdSchema,
  format:z.string().min(1),human_reviewed:z.boolean(),approved:z.boolean(),corrections:z.int().nonnegative(),fallbacks:z.int().nonnegative(),
  currency:z.string().regex(/^[A-Z]{3}$/),confirmed_minor:MoneySchema.nullable(),human_minutes:z.number().nonnegative().nullable()})
  .refine(value=>!value.approved||value.human_reviewed,{message:'Aceite exige revisão humana registrada.'});
/** Relatório do recorte observado; não altera o perfil nem libera repertório automaticamente. */
export function calibrationReport(raw:unknown[],targets:{minimum_samples:number;approval_rate:number}){
  const observations=raw.map(item=>CalibrationObservationSchema.parse(item));
  if(!Number.isInteger(targets.minimum_samples)||targets.minimum_samples<1||targets.approval_rate<0||targets.approval_rate>1)throw new Error('calibration_targets_invalid');
  if(new Set(observations.map(item=>`${item.production.id}:${item.production.version}`)).size!==observations.length)throw new Error('calibration_duplicate_observation');
  const profiles=new Set(observations.map(item=>`${item.profile.id}:${item.profile.version}`)),currencies=new Set(observations.map(item=>item.currency));
  if(profiles.size>1||currencies.size>1)throw new Error('calibration_scope_mixed');
  const reviewed=observations.filter(item=>item.human_reviewed),approved=reviewed.filter(item=>item.approved),rate=reviewed.length?approved.length/reviewed.length:null;
  const knownCosts=observations.every(item=>item.confirmed_minor!==null),knownTime=observations.every(item=>item.human_minutes!==null);
  return {samples:observations.length,reviewed:reviewed.length,approved:approved.length,approval_rate:rate,
    corrections:observations.reduce((sum,item)=>sum+item.corrections,0),fallbacks:observations.reduce((sum,item)=>sum+item.fallbacks,0),
    currency:observations[0]?.currency??null,confirmed_minor:knownCosts?observations.reduce((sum,item)=>sum+item.confirmed_minor!,0):null,
    human_minutes:knownTime?observations.reduce((sum,item)=>sum+item.human_minutes!,0):null,
    article_classes:[...new Set(observations.map(item=>item.article_class))],formats:[...new Set(observations.map(item=>item.format))],
    targets_met:reviewed.length>=targets.minimum_samples&&rate!==null&&rate>=targets.approval_rate&&knownCosts&&knownTime,
    automatic_profile_validation:false};
}
