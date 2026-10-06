import { DossierSchema, ProductionSnapshotSchema, type ProductionSnapshot, type VersionRef, type Dossier } from '@fbr/contracts';
import { ApplicationError, canonical, sha256, inspectDossier, sameRef, ProductionService } from '@fbr/domain';

export const PLANNER_VERSION = 'extractive-0.1';
const ref = (value: VersionRef): VersionRef => ({id:value.id,version:value.version});
const issue = (code:string,message:string,next_action:string) => ({code,message,next_action,required:true});
export class PlanningBlocked extends Error {
  constructor(public readonly issues: Dossier['pending_issues']) { super(issues.map(i=>i.message).join(' ')); }
}
function block(code:string,message:string,next_action='Revisar as entradas e criar uma produção com as revisões corrigidas.'):never {
  throw new PlanningBlocked([issue(code,message,next_action)]);
}

// Extractive baseline: source text is data, never executable instructions or new testimony.
// A semantic rewrite requires a separately configured and evaluated planner.
export function planProduction(raw: ProductionSnapshot, production: VersionRef): Dossier {
  const parsed=ProductionSnapshotSchema.safeParse(raw);
  if(!parsed.success)block('snapshot_schema_invalid','Snapshot não atende ao contrato de planejamento.');
  const snapshot=parsed.data;
  const {hash,...payload}=snapshot;
  if(hash!==sha256(canonical(payload)) || snapshot.production_id!==production.id)
    block('snapshot_invalid','Snapshot de planejamento inconsistente.');
  const {article,profile,character,request,catalog}=snapshot;
  if(sha256(article.content)!==article.content_hash || sha256(snapshot.bible_original)!==character.bible.original_hash)
    block('source_hash_invalid','A integridade do artigo ou Bible não confere.');
  if(!article.complete || !article.character || !sameRef(article.character,character) || !sameRef(profile.character,character))
    block('source_ineligible','Autoria ou completude incompatível com a personagem fixada.');
  if(profile.language!=='pt-BR') block('language_unsupported','O planejador extrativo inicial atende apenas pt-BR.');
  if(request.overrides?.editorial_scope) block('editorial_scope_unsupported','Recorte editorial livre exige interpretação semântica ainda não configurada.');
  const recipe=catalog.recipes.find(r=>r.id===profile.recipe);
  if(!recipe || recipe.state==='experimental') block('recipe_unsupported','Receita ausente ou experimental.');
  if(recipe.requires_source_personal_account) block('personal_account_review','Relato pessoal exige validar quem viveu a experiência, inclusive citações. A extração literal não comprova isso.');
  if(!['explanation','recommendation_list','reflection'].includes(recipe.id))block('recipe_unsupported','Receita fora do subconjunto extrativo implementado.');
  if(!profile.permitted_shot_classes.includes('editorial_illustration') || recipe.sections.some(s=>!s.shot_classes.includes('editorial_illustration')))
    block('repertoire_unsupported','Este planejador exige ilustração editorial estática permitida em todas as seções. Não substitui automaticamente cenas de avatar ou ação.');
  if(request.overrides?.preferred_environment) block('environment_unsupported','Ambiente específico exige direção semântica; o planejador extrativo não insere cenários físicos.');
  if(article.content.length>30000 || article.segments.length>200) block('source_limit','Artigo excede o limite local de 30.000 caracteres ou 200 trechos. Nenhum trecho foi truncado.');
  if(new Set(article.segments.map(s=>s.id)).size!==article.segments.length || article.segments.some(s=>!article.content.includes(s.text)))
    block('segments_invalid','Trechos duplicados ou sem correspondência literal no artigo.');
  const normalize=(text:string)=>text.replace(/\s+/gu,' ').trim();
  if(normalize(article.segments.map(s=>s.text).join(' '))!==normalize(article.content))
    block('segments_incomplete','Os trechos não cobrem integralmente o artigo na ordem original.');
  if(!catalog.shot_classes.some(c=>c.id==='editorial_illustration'&&c.routes.includes('still_image')))
    block('route_unsupported','Catálogo fixado não permite ilustração editorial estática.');
  const at=snapshot.captured_at, author=`planner:${PLANNER_VERSION}`;
  const meta=(id:string)=>({id,version:1,created_at:at,author,changes:[{at,author,reason:'Planejamento extrativo sobre snapshot imutável.'}]});
  const blocks=article.segments.map((segment,index)=>{
    const section=recipe.sections[Math.min(recipe.sections.length-1,Math.floor(index*recipe.sections.length/article.segments.length))]!;
    return {id:`block_${index+1}`,sequence:index,intent:`${section.role}: preservar o trecho ${segment.id}.`,
      visual_function:index===0?'present' as const:index===article.segments.length-1?'conclude' as const:'contextualize' as const,
      speeches:[...(index===0?[{id:'speech_intro',text:'Quero compartilhar com você este texto.',kind:'transicao_convite' as const,mode:'voice_over' as const,sources:[]}]:[]),
        {id:`speech_${index+1}`,text:segment.text,kind:'afirmacao_factual' as const,mode:'voice_over' as const,
          sources:[{kind:'article' as const,document:ref(article),segment_id:segment.id}]}]};
  });
  const shots=blocks.map((b,index)=>({ ...meta(`shot_${production.id}_${production.version}_${index+1}`),status:'specified',block_id:b.id,intent:b.intent,
    route:'still_image',shot_class:'editorial_illustration',speech_segment_ids:b.speeches.map(s=>s.id),
    references:{character:null,environment:null,wardrobe:null,props:[],style:null,composition:null},
    visual:{framing:'Composição editorial estática, sem representação de experiência real.',
      required_elements:[`Tema do trecho: ${article.segments[index]!.text}`],initial_state:'Ilustração editorial estática.',
      action:'Exibir uma ilustração conceitual do trecho, sem demonstrar procedimentos ou relações causais adicionais.',final_state:'A mesma ilustração.',
      camera:'Frontal fixa.',camera_motion:'Nenhum.',subject_motion:'Nenhum.',layout:'Área central para ilustração; faixa inferior livre.',
      lighting:'Uniforme.',subtitle_safe_area:'Reservar 20% inferiores para legendas; validar no formato de entrega.',fixed_elements:['Composição estática','Faixa inferior livre']},
    duration:{target_seconds:Math.max(1,Math.round(b.speeches.reduce((n,s)=>n+s.text.split(/\s+/u).length,0)/2.5*10)/10),resolved_seconds:null},
    continuity_in:index?['Manter tratamento editorial e área de legenda do plano anterior.']:[],
    continuity_out:index<blocks.length-1?['Manter tratamento editorial e área de legenda no próximo plano.']:[],dependencies:[],
    constraints:['Não retratar a autora como participante de fatos relatados.','Não acrescentar pessoas, objetos ou ações factuais não sustentados pelo trecho.',...request.overrides?.avoid??[]],
    risks:['Correspondência semântica entre texto e imagem exige revisão humana.','Texto pode conter citações ou instruções; a leitura literal precisa de revisão editorial.'],
    mandatory_criteria:['Correspondência com o trecho fixado.','Ausência de identidade ou testemunho inventado.','Legendas legíveis no formato de entrega.'],
    fallback:{description:'Recompor a mesma ilustração estática; revisão humana antes de mudar intenção.',route:'still_image',changes_narrative_intent:false}}));
  const estimated=shots.reduce((n,s)=>n+s.duration.target_seconds,0);
  const target=request.overrides?.target_seconds??profile.target_seconds;
  const pending=[issue('editorial_review_required','Extração literal com convite em primeira pessoa; reescrita narrativa e interpretação de citações ainda exigem revisão.','Revisar fidelidade, autoria das experiências e direção antes de qualquer geração.')];
  if(target && Math.abs(estimated-target)>target*0.25) pending.push(issue('duration_mismatch',`Estimativa de leitura: ${estimated.toFixed(1)} s; alvo: ${target} s. Nenhuma fala foi inventada para preencher duração.`, 'Revisar o alvo ou o recorte em uma nova produção; confirmar duração após áudio real.'));
  const dossier=DossierSchema.parse({...meta(`dossier_${production.id}_${production.version}`),status:'specified',production:ref(production),article:ref(article),profile:ref(profile),character:ref(character),
    briefing:{objective:'Apresentar o artigo preservando literalmente seus trechos.',audience:'Público do artigo; adequação a confirmar em revisão.',message:article.title,
      narrative_situation:'Autora apresenta o texto com convite em primeira pessoa; conteúdo extraído literalmente, sem reescrita semântica.',
      visual_arc:`${recipe.id} v${recipe.version}: ilustrações editoriais estáticas acompanhando a ordem do artigo. Método ${PLANNER_VERSION}.`,omitted_content:[]},
    editorial_sources:[],blocks,shots,assets:[],jobs:[],evaluations:[],approvals:[],timeline:null,pending_issues:pending});
  const invalid=inspectDossier(dossier,article,profile);
  if(invalid.some(i=>i.required)) throw new PlanningBlocked(invalid);
  return dossier;
}

// One bounded deterministic attempt per active preparation revision. CAS protects pause/cancel;
// the persisted script_direction state can be recovered after a process restart.
export class AutomaticPlanner {
  private readonly active=new Map<string,Promise<void>>();
  constructor(private readonly productions:ProductionService,
    private readonly engine:{plan(snapshot:ProductionSnapshot,production:VersionRef):Promise<Dossier>}|null=null) {}
  get background() {return this.engine!==null;}
  async waitForIdle() {await Promise.allSettled([...this.active.values()]);}
  run(id:string):Promise<void> {
    const existing=this.active.get(id);if(existing)return existing;
    const promise=this.execute(id).finally(()=>this.active.delete(id));this.active.set(id,promise);return promise;
  }
  async recover() { for(const p of await this.productions.store.list()) if(p.status==='preparing') await this.run(p.id); }
  private async execute(id:string) {
    let current=(await this.productions.detail(id)).production;
    if(current.status!=='preparing')return;
    try {
      if(current.stage==='preparation') current=await this.productions.planning({command_id:`plan_start:${id}:${current.version}`,production:ref(current),action:'planning_started'});
      if(current.stage!=='script_direction')return;
      const snapshot=(await this.productions.detail(id)).snapshot;
      let dossier:Dossier;
      try { dossier=this.engine?await this.engine.plan(snapshot,ref(current)):planProduction(snapshot,ref(current)); }
      catch(error) {
        if(error instanceof Error&&error.message==='oauth_execution_busy')return;
        const issues=error instanceof PlanningBlocked?error.issues:[issue('planner_invalid','Não foi possível validar o planejamento local.','Revisar o diagnóstico técnico antes de retomar.')];
        await this.productions.planning({command_id:`plan_fail:${id}:${current.version}`,production:ref(current),action:'planning_failed',issues});return;
      }
      await this.productions.planning({command_id:`plan_complete:${id}:${current.version}`,production:ref(current),action:'planning_completed',dossier});
    } catch(error) {
      if(error instanceof ApplicationError && error.code==='conflict')return;
      if(error instanceof ApplicationError && error.code==='ineligible') {
        const latest=(await this.productions.detail(id)).production;
        if(latest.version!==current.version || latest.status!=='preparing')return;
      }
      throw error;
    }
  }
}
