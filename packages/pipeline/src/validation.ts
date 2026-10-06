import { AdapterRequestSchema, EligibilitySchema, ProfileSchema, ArticleSchema, CharacterSchema, ReferenceSchema,
  type AdapterRequest, type ModelOperation, type PipelineCatalog, type Eligibility, type Profile, type Article,
  type Character, type Reference, type ShotClassDefinitionSchema } from '@fbr/contracts';
import { productionEligibility, sameRef } from '@fbr/domain';
import type { z } from 'zod';

type Issue = Eligibility['blockers'][number];
const issue = (code: string, message: string, next_action = 'Revisar a configuração e a evidência antes de executar.'): Issue =>
  ({ code, message, next_action, required: true });

/** Verifica o schema documentado; nunca envia requisição e nunca autoriza um provedor. */
export function validateModelRequest(model: ModelOperation, raw: AdapterRequest): Issue[] {
  const parsed = AdapterRequestSchema.safeParse(raw);
  if (!parsed.success) return [issue('request_invalid', 'Requisição fora do contrato do adapter.')];
  const request = parsed.data;
  const blockers: Issue[] = [];
  if (model.documentation !== 'schema_reviewed') blockers.push(issue('schema_unverified','Schema específico do modelo/operação ainda não verificado.'));
  if (request.operation !== model.operation || request.route !== model.route) blockers.push(issue('operation_mismatch','Modelo não corresponde à operação/rota solicitada.'));
  if (request.references.length && model.references !== 'supported') blockers.push(issue('references_unsupported','Referências não têm suporte documentado nesta operação.'));
  if (model.required_inputs.some(kind => kind !== 'identity') && !request.input_assets.length) blockers.push(issue('inputs_missing','A rota exige assets de entrada versionados; parâmetros URL não os substituem.'));
  if (model.required_inputs.includes('identity') && !request.references.length) blockers.push(issue('identity_missing','A rota exige a identidade/voz fixada em referência versionada.'));
  for (const name of Object.keys(request.parameters)) {
    if (!model.parameters.some(rule => rule.name === name)) blockers.push(issue('field_unsupported',`Campo sem suporte: ${name}.`));
  }
  for (const rule of model.parameters) {
    const value = request.parameters[rule.name];
    if (value === undefined) {
      if (rule.required) blockers.push(issue('field_required',`Campo obrigatório ausente: ${rule.name}.`));
      continue;
    }
    if (value === null && rule.nullable) continue;
    const type = rule.type === 'integer' ? 'number' : rule.type;
    if (typeof value !== type || (rule.type === 'integer' && !Number.isSafeInteger(value))
      || (typeof value === 'string' && !value.trim().length)
      || (typeof value === 'number' && ((rule.minimum !== null && value < rule.minimum) || (rule.maximum !== null && value > rule.maximum)))
      || (rule.choices.length && !rule.choices.some(choice => choice === value))) {
      blockers.push(issue('field_invalid',`Valor inválido: ${rule.name}.`));
    }
    if (rule.name.endsWith('_url') && typeof value === 'string') {
      try { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); }
      catch { blockers.push(issue('url_invalid',`URL pública HTTPS sem credenciais exigida: ${rule.name}.`)); }
    }
  }
  return blockers;
}

export interface ConfigurationCheck {
  article: Article; profile: Profile; character: Character | null; references: Reference[];
  mode: 'calibration'|'recurring'; article_class: string; format: string; model_operations: string[];
}
export function checkAudiovisualConfiguration(input: ConfigurationCheck, catalog: PipelineCatalog): Eligibility {
  const article = ArticleSchema.parse(input.article);
  const profile = ProfileSchema.parse(input.profile);
  const references = input.references.map(ref => ReferenceSchema.parse(ref));
  const character = input.character && CharacterSchema.parse(input.character);
  const blockers = [...productionEligibility(article, profile, input.mode).blockers];
  const add = (code: string, message: string) => blockers.push(issue(code,message));
  if (!character || !sameRef(character,profile.character) || character.status !== 'confirmed' || !character.bible.interpretation_confirmed)
    add('identity_unconfirmed','Identidade/Bible da revisão do perfil não estão confirmados.');
  const recipe = catalog.recipes.find(r => r.id === profile.recipe);
  if (profile.delivery && input.format !== `${profile.delivery.width}x${profile.delivery.height}@${profile.delivery.fps}`)
    add('delivery_format_mismatch','Formato solicitado difere do formato fixado no perfil.');
  if (!recipe) add('recipe_unknown','Receita ausente do catálogo.');
  else {
    if (!recipe.article_classes.includes(input.article_class)) add('article_class_mismatch','Estrutura do artigo fora da receita.');
    if (recipe.state === 'experimental') add('recipe_experimental','Tutorial demonstrativo exige calibração de ações específicas ainda não registrada.');
    if (recipe.requires_source_personal_account) add('personal_source_review_required','Relato pessoal precisa de sustentação editorial nos trechos da fonte; validação de roteiro ainda pendente.');
    for (const section of recipe.sections) if (!section.shot_classes.some(cls => profile.permitted_shot_classes.includes(cls)))
      add('recipe_repertoire_missing',`Repertório não atende à função narrativa ${section.role}.`);
  }
  const allowedRefs = [...profile.permitted_references, ...(profile.voice ? [profile.voice] : [])];
  const referenceReady = (ref: Reference) => ref.status === 'approved' && ref.usage_permission === 'allowed' && ref.asset_refs.length > 0;
  for (const ref of allowedRefs) {
    const resolved = references.find(r => sameRef(r,ref));
    if (!resolved || resolved.status !== 'approved' || resolved.usage_permission !== 'allowed' || !resolved.asset_refs.length)
      add('reference_unready',`Referência ${ref.id}:v${ref.version} não possui assets aprovados/direitos confirmados.`);
  }
  if (profile.voice && !references.some(r => sameRef(r,profile.voice!) && r.kind === 'voice')) add('voice_kind_invalid','A voz oficial deve apontar para uma referência vocal.');
  if (profile.voice && (!character?.voice || !sameRef(character.voice,profile.voice))) add('official_voice_mismatch','Voz oficial da personagem não está fixada na mesma revisão do perfil.');
  for (const cls of profile.permitted_shot_classes) {
    const definition = catalog.shot_classes.find(d => d.id === cls);
    if (!definition) { add('shot_class_unknown',`Classe desconhecida: ${cls}.`); continue; }
    for (const kind of definition.required_reference_kinds) {
      const candidates = kind === 'character' ? (character?.references ?? []) : allowedRefs;
      if (!candidates.some(ref => references.some(r => sameRef(r,ref) && r.kind === kind && referenceReady(r))))
        add('reference_kind_missing',`Classe ${cls} exige referência aprovada de ${kind}, com uso permitido e assets declarados.`);
    }
    if (!input.model_operations.some(id => {
      const m = catalog.models.find(candidate => candidate.id === id);
      return m?.route !== null && m?.route !== undefined && definition.routes.includes(m.route);
    })) add('route_missing',`Não há operação selecionada para ${cls}.`);
  }
  if (!input.model_operations.length) add('models_missing','Selecionar operações candidatas para o ensaio.');
  for (const operation of ['audio','render'] as const) if (!input.model_operations.some(id => catalog.models.some(m => m.id === id && m.operation === operation)))
    add('operation_missing',`Operação ${operation} não configurada.`);
  for (const id of input.model_operations) {
    const model = catalog.models.find(m => m.id === id);
    if (!model) { add('model_unknown',`Operação técnica desconhecida: ${id}.`); continue; }
    if (model.documentation !== 'schema_reviewed') add('schema_unverified',`Schema não verificado: ${id}.`);
    if (model.account_access !== 'verified') add('account_unverified',`Acesso da conta não confirmado: ${id}.`);
    if (model.runtime !== 'real') add('real_adapter_missing',`Adapter real indisponível: ${id}.`);
    if (model.required_inputs.includes('image') && !input.model_operations.some(operation => catalog.models.some(m => m.id === operation && m.operation === 'image'))
      && !references.some(ref => ref.kind !== 'voice' && referenceReady(ref) && [...allowedRefs, ...(character?.references ?? [])].some(fixed => sameRef(fixed,ref))))
      add('image_input_unconfigured',`Operação ${id} exige imagem versionada: configurar geração de imagem ou referência visual aprovada.`);
    if (model.operation === 'avatar' && model.official_audio !== 'supported') add('official_audio_unsupported',`Avatar não aceita áudio oficial: ${id}.`);
    for (const cls of profile.permitted_shot_classes) {
      const definition = catalog.shot_classes.find(d => d.id === cls);
      if (model.route && definition?.routes.includes(model.route) && definition.required_reference_kinds.length && model.references !== 'supported' && model.operation !== 'avatar')
        add('model_reference_unsupported',`Operação ${id} não sustenta referências exigidas por ${cls}.`);
    }
    if (input.mode === 'recurring' && recipe && !catalog.calibrations.some(e => sameRef(e.profile,profile)
      && e.recipe === recipe.id && e.recipe_version === recipe.version && e.model_operation === id
      && e.article_classes.includes(input.article_class) && e.formats.includes(input.format)
      && profile.permitted_shot_classes.filter(cls => model.route && catalog.shot_classes.some(d => d.id === cls && d.routes.includes(model.route!)))
        .every(cls => e.shot_classes.includes(cls))
      && e.evidence_refs.every(ref => profile.calibration_scope?.evidence_refs.includes(ref)))) add('calibration_scope_missing',`Operação ${id} fora do escopo calibrado da revisão do perfil.`);
  }
  if (input.mode === 'recurring' && (!profile.calibration_scope?.article_classes.includes(input.article_class) || !profile.calibration_scope.formats.includes(input.format)))
    add('profile_scope_mismatch','Artigo/formato fora do escopo do perfil.');
  return EligibilitySchema.parse({ allowed: blockers.length === 0, calibration_only: input.mode === 'calibration' || profile.status !== 'validated', blockers });
}

export function permittedFallbacks(definition: z.infer<typeof ShotClassDefinitionSchema>, profile: Profile, catalog: PipelineCatalog,
  scope: { mode: 'calibration'|'recurring'; article_class: string; format: string }) {
  return definition.fallbacks.filter(fallback => profile.permitted_shot_classes.includes(fallback.shot_class)
    && (scope.mode === 'calibration' || (profile.status === 'validated' && profile.calibration_scope?.article_classes.includes(scope.article_class)
      && profile.calibration_scope.formats.includes(scope.format) && catalog.calibrations.some(e => sameRef(e.profile,profile)
      && e.recipe === profile.recipe && e.recipe_version === catalog.recipes.find(r => r.id === profile.recipe)?.version
      && e.shot_classes.includes(fallback.shot_class) && e.article_classes.includes(scope.article_class) && e.formats.includes(scope.format)
      && catalog.models.some(m => m.id === e.model_operation && m.route === fallback.route && m.documentation === 'schema_reviewed' && m.runtime === 'real' && m.account_access === 'verified')
      && e.evidence_refs.every(ref => profile.calibration_scope?.evidence_refs.includes(ref))))));
}
