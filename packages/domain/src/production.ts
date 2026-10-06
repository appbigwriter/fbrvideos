import { randomUUID } from 'node:crypto';
import { ProductionSchema, ProductionSnapshotSchema, ProductionDetailSchema, ProductionCommandSchema, CreateProductionRequestSchema,
  PlanningCommandSchema, DossierSchema, type Production, type ProductionSnapshot, type ProductionEvent, type Dossier,
  type Article, type Profile, type Character, type Reference, type PipelineCatalog } from '@fbr/contracts';
import { ApplicationError, canonical, sha256, type ConfigurationReader } from './configuration.js';
import { productionEligibility, inspectDossier, sameRef } from './index.js';

export interface ProductionReader {
  get(id: string, version?: number): Promise<Production|null>;
  list(): Promise<Production[]>;
  snapshot(id: string): Promise<ProductionSnapshot|null>;
  dossier(ref: {id:string;version:number}): Promise<Dossier|null>;
  events(id: string): Promise<ProductionEvent[]>;
}
export interface ProductionTransaction extends ProductionReader {
  configuration: ConfigurationReader;
  append(record: Production, expected: number|null, event: ProductionEvent): Promise<void>;
  saveSnapshot(snapshot: ProductionSnapshot): Promise<void>;
  saveDossier(dossier: Dossier): Promise<void>;
}
export interface ProductionStore extends ProductionReader {
  command(id: string, fingerprint: string, run: (tx: ProductionTransaction) => Promise<Production>): Promise<Production>;
}
const pendingPlanner = {code:'planner_pending',message:'Planejamento narrativo ainda não executado.',next_action:'Aguardar o planejamento local ou retomar após verificar o serviço.',required:true};
export function productionActions(p: Production) {
  return {pause:['preparing','awaiting_decision','producing','correcting','ready_for_review'].includes(p.status),resume:['paused','failed'].includes(p.status),
    cancel:['preparing','awaiting_decision','producing','correcting','ready_for_review','paused','failed'].includes(p.status)};
}
export class ProductionService {
  constructor(public readonly store: ProductionStore,private readonly catalog: PipelineCatalog) {}
  async detail(id: string, version?: number) {
    const production = await this.store.get(id,version);
    const snapshot = await this.store.snapshot(id);
    if (!production || !snapshot) throw new ApplicationError('not_found','Produção ou revisão não encontrada.');
    const events = (await this.store.events(id)).filter(e => e.production.version <= production.version);
    return ProductionDetailSchema.parse({production,snapshot,events,actions:productionActions(production),
      dossier:production.dossier ? await this.store.dossier(production.dossier) : null});
  }
  async create(raw: unknown): Promise<Production> {
    const request = CreateProductionRequestSchema.parse(raw);
    return this.store.command(request.command_id,sha256(canonical({action:'create',request})),async tx => {
      const article = await tx.configuration.get('articles',request.article.id,request.article.version) as Article|null;
      const profile = await tx.configuration.get('profiles',request.profile.id,request.profile.version) as Profile|null;
      if (!article || !profile) throw new ApplicationError('not_found','Artigo ou perfil na revisão selecionada não encontrado.');
      const eligibility = productionEligibility(article,profile,request.mode);
      if (!eligibility.allowed) throw new ApplicationError('ineligible',eligibility.blockers.map(i => i.message).join(' '));
      const recipe = this.catalog.recipes.find(r => r.id === profile.recipe);
      if (!recipe || recipe.state === 'experimental') throw new ApplicationError('ineligible','Receita desconhecida ou experimental sem calibração de ações.');
      if (recipe.sections.some(section => !section.shot_classes.some(cls => profile.permitted_shot_classes.includes(cls))))
        throw new ApplicationError('ineligible','Repertório do perfil não atende à receita escolhida.');
      if (request.mode === 'recurring' && !this.catalog.calibrations.some(e => sameRef(e.profile,profile) && e.recipe===recipe.id && e.recipe_version===recipe.version))
        throw new ApplicationError('ineligible','Não há registro de calibração desta revisão/receita no servidor.');
      const character = await tx.configuration.get('characters',profile.character.id,profile.character.version) as Character|null;
      if (!character || character.status !== 'confirmed' || !character.bible.interpretation_confirmed) throw new ApplicationError('ineligible','Personagem/Bible não confirmados.');
      const bible = await tx.configuration.bible(character.bible.original_hash);
      if (!bible || sha256(bible) !== character.bible.original_hash) throw new ApplicationError('ineligible','Bible original não disponível ou inconsistente.');
      const refs = [...character.references,...profile.permitted_references,...(profile.voice ? [profile.voice] : []),
        ...(request.overrides?.preferred_environment ? [request.overrides.preferred_environment] : [])];
      const references: Reference[] = [];
      for (const ref of refs) {
        if (references.some(r => sameRef(r,ref))) continue;
        const resolved = await tx.configuration.get('references',ref.id,ref.version) as Reference|null;
        if (!resolved || resolved.status === 'archived') throw new ApplicationError('ineligible','Referência fixada ausente ou arquivada.');
        references.push(resolved);
      }
      if (request.overrides?.preferred_environment && !profile.permitted_references.some(r => sameRef(r,request.overrides!.preferred_environment!)))
        throw new ApplicationError('ineligible','Ambiente fora do repertório permitido do perfil.');
      if (request.overrides?.preferred_environment && !references.some(r => sameRef(r,request.overrides!.preferred_environment!) && r.kind==='environment'))
        throw new ApplicationError('ineligible','A referência selecionada não é um ambiente.');
      const id = randomUUID(), now = new Date().toISOString();
      const content = {production_id:id,captured_at:now,request,article,profile,character,references,bible_original:bible,catalog:this.catalog};
      await tx.saveSnapshot(ProductionSnapshotSchema.parse({...content,hash:sha256(canonical(content))}));
      const production = ProductionSchema.parse({id,version:1,created_at:now,author:'local_operator',changes:[{at:now,author:'local_operator',reason:'Produção criada com entradas fixadas.'}],
        status:'preparing',stage:'preparation',name:request.name,mode:request.mode,article:request.article,profile:request.profile,character:profile.character,
        dossier:null,current_render:null,current_approval:null,costs:{currency:profile.budget!.currency,estimated_minor:null,committed_minor:0,confirmed_minor:0,
          ceiling_minor:profile.budget!.ceiling_minor,safety_margin_minor:profile.budget!.safety_margin_minor},pending_issues:[pendingPlanner]});
      await tx.append(production,null,{id:randomUUID(),production:{id,version:1},at:now,type:'created',message:'Entradas fixadas; aguardando planejamento. Nenhuma geração iniciada.'});
      return production;
    });
  }
  async command(raw: unknown): Promise<Production> {
    const command = ProductionCommandSchema.parse(raw);
    return this.store.command(command.command_id,sha256(canonical({action:'user_command',command})),async tx => {
      const current = await tx.get(command.production.id);
      if (!current) throw new ApplicationError('not_found','Produção não encontrada.');
      if (current.version !== command.production.version) throw new ApplicationError('conflict','A produção mudou. Recarregue antes de enviar o comando.');
      if (command.action === 'approve_final') throw new ApplicationError('ineligible','Aprovação exige render e workflow de revisão ainda indisponíveis.');
      const actions = productionActions(current);
      if (!actions[command.action]) throw new ApplicationError('ineligible','Comando não permitido neste estado.');
      let resumed:Production|null=null;
      if(command.action==='resume'&&current.status==='paused'){
        const paused=(await tx.events(current.id)).filter(event=>event.type==='paused').at(-1);
        resumed=paused?await tx.get(current.id,paused.production.version-1):null;
        if(!resumed||!productionActions(resumed).pause)throw new ApplicationError('ineligible','Estado anterior da pausa não disponível; conferir histórico antes de retomar.');
      }
      const status = command.action === 'pause' ? 'paused' : command.action === 'cancel' ? 'cancelled' : resumed?.status??(current.dossier ? 'awaiting_decision' : 'preparing');
      return this.revise(tx,current,{status,...(command.action === 'resume'&&!current.dossier?{stage:'preparation' as const,pending_issues:[pendingPlanner]}:{})},command.action === 'pause' ? 'paused' : command.action === 'cancel' ? 'cancelled' : 'resumed',
        command.action === 'resume' ? 'Preparação retomada; geração permanece condicionada às pendências.' : command.action === 'pause' ? 'Novos trabalhos pausados.' : 'Produção cancelada.');
    });
  }
  // Entrada interna do planejador; não existe endpoint público para inserir um dossiê ou fingir conclusão.
  async planning(raw: unknown): Promise<Production> {
    const command = PlanningCommandSchema.parse(raw);
    return this.store.command(command.command_id,sha256(canonical({action:'planning',command})),async tx => {
      const current = await tx.get(command.production.id);
      if (!current) throw new ApplicationError('not_found','Produção não encontrada.');
      if (current.version !== command.production.version) throw new ApplicationError('conflict','Revisão de produção desatualizada.');
      if (command.action === 'planning_started') {
        if (current.status !== 'preparing' || current.stage !== 'preparation') throw new ApplicationError('ineligible','Planejamento exige preparação ativa.');
        return this.revise(tx,current,{stage:'script_direction'},'planning_started','Planejamento iniciado.');
      }
      if (current.status !== 'preparing' || current.stage !== 'script_direction') throw new ApplicationError('ineligible','Não há planejamento ativo nesta revisão.');
      if (command.action === 'planning_failed') {
        const issues = command.issues?.length ? command.issues : [{code:'planning_failed',message:'Planejamento falhou.',next_action:'Revisar a causa antes de uma nova tentativa.',required:true}];
        return this.revise(tx,current,{status:'failed',pending_issues:issues},'planning_failed','Planejamento falhou; nenhuma geração iniciada.');
      }
      if (!command.dossier) throw new ApplicationError('validation','Conclusão exige dossiê estruturado.');
      const dossier = DossierSchema.parse(command.dossier);
      const snapshot = await tx.snapshot(current.id);
      if (!snapshot || !sameRef(dossier.production,current) || !sameRef(dossier.article,current.article) || !sameRef(dossier.profile,current.profile)
        || !sameRef(dossier.character,current.character)) throw new ApplicationError('ineligible','Dossiê não corresponde às entradas fixadas.');
      if (dossier.assets.length || dossier.jobs.length || dossier.approvals.length || dossier.evaluations.length || dossier.timeline
        || !['draft','specified'].includes(dossier.status) || dossier.shots.some(s => !['draft','specified'].includes(s.status))) throw new ApplicationError('ineligible','Planejamento não pode apresentar geração/aprovação/montagem fictícia.');
      const issues = inspectDossier(dossier,snapshot.article,snapshot.profile);
      if (issues.some(i => i.required)) throw new ApplicationError('ineligible',issues.map(i => i.message).join(' '));
      await tx.saveDossier(dossier);
      return this.revise(tx,current,{status:'awaiting_decision',dossier:{id:dossier.id,version:dossier.version},pending_issues:[...dossier.pending_issues,
        {code:'audiovisual_gate_pending',message:'Dossiê registrado; fidelidade editorial, piloto e geração ainda dependem de validação.',next_action:'Revisar o planejamento e concluir o gate audiovisual.',required:true}]},'planning_completed','Dossiê persistido; aguardando validação, sem geração automática.');
    });
  }
  private async revise(tx: ProductionTransaction,current: Production,patch: Partial<Production>,type: ProductionEvent['type'],message: string) {
    const now = new Date().toISOString();
    const record = ProductionSchema.parse({...current,...patch,version:current.version+1,created_at:now,
      changes:[...current.changes,{at:now,author:'local_operator',reason:message}]});
    await tx.append(record,current.version,{id:randomUUID(),production:{id:record.id,version:record.version},at:now,type,message});
    return record;
  }
}
