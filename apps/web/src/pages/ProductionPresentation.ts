import { CreateProductionRequestSchema, DossierPresentationSchema, ProductionSummarySchema,
  type Article, type Profile, type ProductionDetail, type ProductionSummary } from '@fbr/contracts';
import type { ProgressPresentation } from '../components/progress/ProductionProgressPanel.js';

export function progressPresentation(detail: Pick<ProductionDetail, 'production' | 'actions'>): ProgressPresentation {
  const {production,actions}=detail;
  const availability=(action:keyof typeof actions) => ({enabled:actions[action],
    reason:actions[action] ? null : 'O servidor não disponibiliza esta ação na revisão atual. Atualize o acompanhamento após uma mudança.'});
  return {ref:{id:production.id,version:production.version},name:production.name,
    status:production.status,stage:production.stage,costs:production.costs,pending_issues:production.pending_issues,
    actions:{pause:availability('pause'),resume:availability('resume'),cancel:availability('cancel')},
    notice:'Acompanhamento dos dados persistidos. A geração de mídia ainda depende do piloto e da validação audiovisual; não está disponível nesta etapa.'};
}

export function productionSetup(article: Article, profile: Profile | undefined,
  name: string, mode: 'calibration' | 'recurring', targetSeconds: string, avoid: string) {
  const blockers: ProductionSummary['blockers'] = [];
  const block = (code: string, message: string, next_action: string) => blockers.push({code,message,next_action,required:true});
  if (!article.complete) block('source_incomplete','A fonte está incompleta.','Corrigir a captura ou colar o texto completo.');
  if (!article.character) block('author_unassigned','A autora não possui personagem associada.','Confirmar associação de autoria.');
  if (!profile) block('profile_required','Selecione um perfil.','Escolher perfil da personagem e revisão do artigo.');
  if (profile) {
    if (profile.character.id !== article.character?.id || profile.character.version !== article.character.version)
      block('character_mismatch','Artigo e perfil usam identidades diferentes.','Escolher perfil da personagem associada.');
    if (profile.status === 'suspended') block('profile_suspended','Perfil suspenso.','Selecionar outro perfil.');
    if (mode === 'recurring' && profile.status !== 'validated')
      block('calibration_required','O perfil permite apenas calibração.','Selecionar calibração ou perfil validado.');
    if (!profile.recipe || !profile.voice || !profile.delivery || !profile.budget || !profile.target_seconds || !profile.permitted_shot_classes.length)
      block('profile_incomplete','Faltam parâmetros essenciais do perfil.','Completar receita, voz, formato, duração, repertório e limites.');
  }
  const overrides = {
    ...(targetSeconds.trim() ? {target_seconds:Number(targetSeconds)} : {}),
    ...(avoid.trim() ? {avoid:avoid.split(/\r?\n/).map(value=>value.trim()).filter(Boolean)} : {}),
  };
  const parsed = CreateProductionRequestSchema.omit({command_id:true}).safeParse({
    contract_version:'0.1.0', article:{id:article.id,version:article.version},
    profile:profile ? {id:profile.id,version:profile.version} : null, name:name.trim(),mode,
    ...(Object.keys(overrides).length ? {overrides} : {}),
  });
  if (targetSeconds.trim() && (!Number.isFinite(Number(targetSeconds)) || Number(targetSeconds)<=0))
    block('target_invalid','A duração-alvo deve ser um número positivo.','Corrigir a duração ou deixar o campo vazio para usar o perfil.');
  if (!name.trim()) block('name_required','Informe o nome da produção.','Preencher o nome para identificar esta produção.');
  const currency = profile?.budget?.currency;
  const money = (value: number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:currency!}).format(value/100);
  const summary = ProductionSummarySchema.parse({article:{ref:{id:article.id,version:article.version},title:article.title},
    profile:profile ? {ref:{id:profile.id,version:profile.version},name:profile.name} : null,mode,
    budget_label:profile?.budget ? `Teto de mídia: ${money(profile.budget.ceiling_minor)} · margem: ${money(profile.budget.safety_margin_minor)}` : null,
    estimate_label:'Estimativa de mídia indisponível. Planejamento por OAuth usa a cota da conta. A elegibilidade final é verificada pelo servidor.',
    blockers,can_submit:parsed.success && blockers.length===0});
  return {summary,request:parsed.success && summary.can_submit ? parsed.data : null};
}

export function dossierPresentation(detail: ProductionDetail) {
  if (!detail.dossier) return {data:null,error:null};
  const parsed=DossierPresentationSchema.safeParse({dossier:detail.dossier,article:detail.snapshot.article,
    notice:'Planejamento somente para inspeção. Revisão editorial humana e validação audiovisual pendentes; nenhuma geração de mídia autorizada nesta etapa.'});
  return parsed.success ? {data:parsed.data,error:null}
    : {data:null,error:'O dossiê não corresponde à revisão do artigo fixada nesta produção.'};
}
