import type {Dossier,ExecutionPolicy,ProductionSnapshot} from '@fbr/contracts';
import {sameRef,inspectDossier} from './index.js';

/** Reads only the policy captured when the production was admitted. No defaults on historical snapshots. */
export function recurringExecutionPolicy(snapshot:ProductionSnapshot):ExecutionPolicy|null{
  const {profile,request,catalog}=snapshot,policy=profile.execution_policy,scope=profile.calibration_scope;
  if(request.mode!=='recurring'||profile.status!=='validated'||!policy||!scope||!profile.delivery||!sameRef(request.profile,profile))return null;
  if(policy.evidence_refs.some(ref=>!scope.evidence_refs.includes(ref))||policy.allowed_shot_classes.some(cls=>!profile.permitted_shot_classes.includes(cls)))return null;
  const recipe=catalog.recipes.find(row=>row.id===profile.recipe);
  const format=`${profile.delivery.width}x${profile.delivery.height}@${profile.delivery.fps}`;
  if(!recipe||recipe.state==='experimental'||!scope.formats.includes(format)||!recipe.article_classes.every(cls=>scope.article_classes.includes(cls)))return null;
  if(!profile.calibration_validation&&!catalog.calibrations.some(row=>sameRef(row.profile,profile)&&row.recipe===recipe.id&&row.recipe_version===recipe.version
    &&row.formats.includes(format)&&policy.allowed_shot_classes.every(cls=>row.shot_classes.includes(cls))&&policy.evidence_refs.every(ref=>row.evidence_refs.includes(ref))))return null;
  return policy;
}

/** Model findings remain blockers; the legacy blanket review gate may be replaced only inside calibrated policy. */
export function operationalPlanningEligible(snapshot:ProductionSnapshot,dossier:Dossier):boolean{
  const policy=recurringExecutionPolicy(snapshot);
  if(!policy||snapshot.request.overrides?.review_script||!dossier.shots.length
    ||dossier.shots.some(shot=>!policy.allowed_shot_classes.includes(shot.shot_class))
    ||dossier.pending_issues.some(issue=>issue.required&&issue.code!=='editorial_review_required')
    ||inspectDossier(dossier,snapshot.article,snapshot.profile).some(issue=>issue.required))return false;
  return dossier.shots.every(shot=>shot.route==='existing_asset'
    ||shot.route==='avatar'&&policy.allowed_operations.includes('avatar')&&policy.allowed_operations.includes('audio')
    ||shot.route==='still_image'&&policy.allowed_operations.includes('image')&&policy.allowed_operations.includes('audio')
    ||shot.route==='animated_scene'&&policy.allowed_operations.includes('image')&&policy.allowed_operations.includes('animation')&&policy.allowed_operations.includes('audio'));
}
