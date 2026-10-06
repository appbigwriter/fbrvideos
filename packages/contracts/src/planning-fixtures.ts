import { ProductionSummarySchema, DossierPresentationSchema } from './planning-ui.js';
import { articleFixture,dossierFixture,fixtureRefs } from './fixtures.js';
export const PLANNING_FIXTURE_NOTICE='SIMULAÇÃO UX AG-05/06 — sem geração, custo estimado ou aprovação real.';
export const productionSummaryFixture=ProductionSummarySchema.parse({article:{ref:fixtureRefs.article,title:articleFixture.title},
  profile:{ref:fixtureRefs.profile,name:'Perfil candidato sintético'},mode:'calibration',budget_label:'BRL 100,00; margem BRL 10,00 (valores sintéticos)',
  estimate_label:'Estimativa indisponível; não autoriza gasto.',blockers:[],can_submit:true});
export const blockedProductionSummaryFixture=ProductionSummarySchema.parse({...productionSummaryFixture,profile:null,budget_label:null,can_submit:false,
  blockers:[{code:'profile_missing',message:'Selecione um perfil compatível.',next_action:'Escolher o perfil.',required:true}]});
export const dossierPresentationFixture=DossierPresentationSchema.parse({article:articleFixture,notice:PLANNING_FIXTURE_NOTICE,
  dossier:{...dossierFixture,status:'specified',assets:[],jobs:[],evaluations:[],approvals:[],timeline:null,
    shots:dossierFixture.shots.map(s=>({...s,status:'specified',duration:{...s.duration,resolved_seconds:null}})),
    pending_issues:[{code:'editorial_review_required',message:'Fidelidade e direção aguardam avaliação humana.',next_action:'Revisar antes de gerar.',required:true}]}});
