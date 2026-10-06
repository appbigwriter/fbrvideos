import test from 'node:test';
import assert from 'node:assert/strict';
import { PipelineCatalogSchema, AdapterRequestSchema, AdapterResultSchema, ProfileSchema,
  CharacterSchema, ReferenceSchema, type AdapterRequest, type ModelOperation } from '@fbr/contracts';
import { articlesConfigurationFixture, profilesConfigurationFixture, universeConfigurationFixture } from '@fbr/contracts/fixtures';
import { getPipelineCatalog, validateModelRequest, checkAudiovisualConfiguration, permittedFallbacks,
  SimulatedGenerationAdapter, simulatedModel } from '../src/index.js';

const catalog = getPipelineCatalog();
const model = (id: string): ModelOperation => {
  const entry = catalog.models.find(m => m.id === id); assert.ok(entry); return entry;
};
const request = (changes: Partial<AdapterRequest> = {}): AdapterRequest => AdapterRequestSchema.parse({
  contract_version:'0.1.0',execution_key:'a'.repeat(64),attempt:1,production:{id:'production_fixture',version:1},
  shot:{id:'shot_fixture',version:1},operation:'image',route:'still_image',input_assets:[],references:[],configuration_hash:'b'.repeat(64),
  parameters:{prompt:'Ilustração sintética sem identidade recorrente'},currency:'BRL',reserved_minor:100,...changes });
function configuredProfile() {
  return ProfileSchema.parse({...profilesConfigurationFixture.items[0],recipe:'explanation',target_seconds:60,
    voice:{id:'voice_s1_fixture',version:1},permitted_shot_classes:['editorial_illustration'],
    delivery:{width:1920,height:1080,fps:24,video_codec:'h264',audio_codec:'aac',audio_sample_rate:48000,subtitle_format:'srt'},
    budget:{currency:'BRL',ceiling_minor:10000,safety_margin_minor:1000,max_attempts_per_job:2}});
}

// Estas condições são sintéticas para testar diagnóstico; não representam acesso ou calibração reais.
function readyConfiguration() {
  const voice = ReferenceSchema.parse({...universeConfigurationFixture.references[0],status:'approved',usage_permission:'allowed',asset_refs:[{id:'voice_asset_fixture',version:1}]});
  const visual = ReferenceSchema.parse({...voice,id:'character_visual_fixture',kind:'character',asset_refs:[{id:'image_asset_fixture',version:1}]});
  const character = CharacterSchema.parse({...universeConfigurationFixture.characters[0],voice:{id:voice.id,version:voice.version},references:[{id:visual.id,version:visual.version}]});
  const models = (['audio','image','avatar','animation','render'] as const).map(operation => ({...simulatedModel(operation),runtime:'real' as const,account_access:'verified' as const}));
  const readyCatalog = PipelineCatalogSchema.parse({...getPipelineCatalog(),models});
  const input = {article:articlesConfigurationFixture.items[0]!.article,profile:configuredProfile(),character,
    references:[voice,visual],mode:'calibration' as const,article_class:'explanation',format:'1920x1080@24',model_operations:['sim_image','sim_audio','sim_render']};
  return {input,catalog:readyCatalog,visual};
}

test('Catálogo preserva candidatos não verificados sem inventar acesso ou calibração', () => {
  PipelineCatalogSchema.parse(catalog);
  assert.equal(catalog.recipes.length,5); assert.equal(catalog.shot_classes.length,6);
  assert.equal(catalog.calibrations.length,0);
  assert.ok(catalog.models.some(m => m.documentation === 'catalog_only'));
  assert.ok(catalog.models.every(m => m.account_access === 'unverified' && m.runtime === 'not_implemented'));
  const returned = getPipelineCatalog(); returned.models.length = 0;
  assert.ok(getPipelineCatalog().models.length > 0, 'consumidor não pode modificar o snapshot compartilhado');
});
test('Campos desconhecidos, tipo errado, identidade não suportada e limites são bloqueados', () => {
  const image = model('hf_soul_standard_image');
  assert.deepEqual(validateModelRequest(image,request()),[]);
  const issues = validateModelRequest(image,request({references:[{id:'identity_fixture',version:1}],parameters:{prompt:'ok',duration:6,seed:0,batch_size:2,style_strength:1.5}}));
  assert.ok(issues.some(i => i.code === 'field_unsupported'));
  assert.ok(issues.some(i => i.code === 'references_unsupported'));
  assert.equal(issues.filter(i => i.code === 'field_invalid').length,3);
  assert.ok(validateModelRequest(image,request({parameters:{prompt:true}})).some(i => i.code === 'field_invalid'));
});
test('Imagem para animação exige entrada versionada e áudio generativo desativado explicitamente', () => {
  const animation = model('hf_seedance2_image_animation');
  const base = request({operation:'animation',route:'animated_scene',parameters:{image_url:'https://example.com/frame.png',duration:5,generate_audio:false},input_assets:[{id:'image_fixture',version:2}]});
  assert.deepEqual(validateModelRequest(animation,base),[]);
  assert.ok(validateModelRequest(animation,{...base,input_assets:[]}).some(i => i.code === 'inputs_missing'));
  for (const duration of [3,16,5.5]) assert.ok(validateModelRequest(animation,{...base,parameters:{...base.parameters,duration}}).some(i => i.code === 'field_invalid'));
  assert.ok(validateModelRequest(animation,{...base,parameters:{...base.parameters,generate_audio:true}}).some(i => i.code === 'field_invalid'));
  const { generate_audio: _audio, ...withoutAudio } = base.parameters;
  assert.ok(validateModelRequest(animation,{...base,parameters:withoutAudio}).some(i => i.code === 'field_required'));
  assert.ok(validateModelRequest(animation,{...base,parameters:{...base.parameters,image_url:'https://user:secret@example.com/frame.png'}}).some(i => i.code === 'url_invalid'));
});
test('Subconjunto de avatar exige áudio externo e recusa script e voice_id substitutos', () => {
  const avatar = model('heygen_audio_avatar');
  const value = request({operation:'avatar',route:'avatar',input_assets:[{id:'audio_fixture',version:1}],references:[{id:'identity_fixture',version:1}],
    parameters:{type:'avatar',avatar_id:'fixture_id',audio_url:'https://example.com/voice.wav'}});
  assert.deepEqual(validateModelRequest(avatar,value),[]);
  assert.equal(validateModelRequest(avatar,{...value,parameters:{...value.parameters,script:'Nova fala',voice_id:'another_voice'}}).filter(i => i.code === 'field_unsupported').length,2);
});
test('Configuração não confunde documentação ou perfil com autorização de produção', () => {
  const profile = configuredProfile();
  const input = {article:articlesConfigurationFixture.items[0]!.article,profile,character:universeConfigurationFixture.characters[0]!,
    references:universeConfigurationFixture.references,mode:'calibration' as const,article_class:'explanation',format:'1920x1080@24',model_operations:['hf_soul_standard_image']};
  const calibration = checkAudiovisualConfiguration(input,catalog);
  assert.equal(calibration.allowed,false); assert.equal(calibration.calibration_only,true);
  for (const code of ['reference_unready','account_unverified','real_adapter_missing','operation_missing']) assert.ok(calibration.blockers.some(i => i.code === code));
  const validated = ProfileSchema.parse({...profile,status:'validated',calibration_scope:{article_classes:['explanation'],formats:['1920x1080@24'],evidence_refs:['invented']}});
  const recurring = checkAudiovisualConfiguration({...input,profile:validated,mode:'recurring'},catalog);
  assert.equal(recurring.allowed,false);
  assert.ok(recurring.blockers.some(i => i.code === 'calibration_scope_missing'));
  const mismatch = checkAudiovisualConfiguration({...input,article_class:'demonstrative_tutorial'},catalog);
  assert.ok(mismatch.blockers.some(i => i.code === 'article_class_mismatch'));
});
test('Alternativas respeitam repertório e escopo e continuam exigindo revisão de direção', () => {
  const definition = catalog.shot_classes.find(c => c.id === 'avatar_on_camera')!;
  const profile = configuredProfile();
  const scope = {mode:'calibration' as const,article_class:'explanation',format:'1920x1080@24'};
  const candidates = permittedFallbacks(definition,profile,catalog,scope);
  assert.equal(candidates.length,1); assert.equal(candidates[0]?.requires_direction_review,true);
  assert.equal(permittedFallbacks(definition,{...profile,permitted_shot_classes:['avatar_on_camera']},catalog,scope).length,0);
  assert.equal(permittedFallbacks(definition,profile,catalog,{...scope,mode:'recurring'}).length,0);
});
test('Adapter simulado deduplica, preserva snapshots e termina sem mídia ou custo', async () => {
  const adapter = new SimulatedGenerationAdapter('image');
  assert.equal((await adapter.capabilities()).mode,'simulated');
  const submitted = AdapterResultSchema.parse(await adapter.submit(request())); assert.equal(submitted.outcome,'accepted');
  if (submitted.outcome !== 'accepted') return;
  const id = submitted.job.external_job_id!;
  assert.deepEqual(await adapter.submit(request()),submitted);
  assert.equal((await adapter.submit(request({parameters:{prompt:'Mudança de intenção'}}))).outcome,'blocked');
  const running = await adapter.query(id); assert.equal(running.outcome,'accepted');
  if (running.outcome === 'accepted') assert.equal(running.job.status,'running');
  assert.equal(submitted.job.status,'queued');
  assert.equal((await adapter.cancel(id)).outcome,'blocked');
  const terminal = await adapter.query(id); assert.equal(terminal.outcome,'accepted');
  if (terminal.outcome === 'accepted') { assert.equal(terminal.job.status,'succeeded'); assert.deepEqual(terminal.job.output_assets,[]); assert.equal(terminal.job.costs.confirmed_minor,0); }
  assert.equal((await adapter.query('missing')).outcome,'blocked');
  const next = await adapter.submit(request({attempt:2})); assert.equal(next.outcome,'accepted');
  if (next.outcome === 'accepted') assert.notEqual(next.job.external_job_id,id);
});
test('Cancelamento simulado só na fila; operação divergente e campos sem suporte são recusados', async () => {
  const adapter = new SimulatedGenerationAdapter('image');
  const submitted = await adapter.submit(request()); assert.equal(submitted.outcome,'accepted');
  if (submitted.outcome !== 'accepted') return;
  const cancelled = await adapter.cancel(submitted.job.external_job_id!);
  assert.equal(cancelled.outcome,'accepted');
  if (cancelled.outcome === 'accepted') assert.equal(cancelled.job.status,'cancelled');
  assert.deepEqual(await adapter.query(submitted.job.external_job_id!),cancelled);
  assert.equal((await adapter.submit(request({operation:'audio',route:null,parameters:{text:'Fala'}}))).outcome,'blocked');
  assert.equal((await adapter.submit(request({parameters:{prompt:'ok',unknown:true}}))).outcome,'blocked');
});
test('Adapters de áudio, avatar, animação e render exercitam fronteiras sem arquivos reais', async () => {
  const inputs = [{id:'input_fixture',version:1}];
  const cases: Partial<AdapterRequest>[] = [
    {operation:'audio',route:null,parameters:{text:'Fala sintética de ensaio',voice_reference:'fixture_voice'},input_assets:inputs},
    {operation:'avatar',route:'avatar',parameters:{type:'avatar',avatar_id:'fixture_avatar',audio_url:'https://example.com/audio.wav'},input_assets:inputs,references:[{id:'identity_fixture',version:1}]},
    {operation:'animation',route:'animated_scene',parameters:{image_url:'https://example.com/image.png',generate_audio:false},input_assets:inputs},
    {operation:'render',route:null,parameters:{timeline_id:'timeline_fixture'},input_assets:inputs},
  ];
  for (const changes of cases) { const result = await new SimulatedGenerationAdapter(changes.operation!).submit(request(changes)); assert.equal(result.outcome,'accepted'); }
});

test('Bible confirmado não substitui referência visual aprovada na revisão fixada', () => {
  const {input,catalog:readyCatalog,visual} = readyConfiguration();
  const avatarInput = {...input,profile:ProfileSchema.parse({...input.profile,permitted_shot_classes:['avatar_on_camera']}),model_operations:['sim_avatar','sim_audio','sim_render']};
  assert.equal(checkAudiovisualConfiguration(avatarInput,readyCatalog).allowed,true);
  for (const invalidVisual of [null,{...visual,status:'pending' as const},{...visual,version:2},{...visual,usage_permission:'denied' as const},{...visual,asset_refs:[]}]) {
    const references = [input.references[0]!,...(invalidVisual ? [invalidVisual] : [])];
    const result = checkAudiovisualConfiguration({...avatarInput,references},readyCatalog);
    assert.equal(result.allowed,false);
    assert.ok(result.blockers.some(i => i.code === 'reference_kind_missing'));
  }
  const profileReference = {...avatarInput,character:{...input.character,references:[]},profile:ProfileSchema.parse({...avatarInput.profile,permitted_references:[{id:visual.id,version:visual.version}]})};
  assert.equal(checkAudiovisualConfiguration(profileReference,readyCatalog).allowed,false,
    'A referência permitida pelo perfil não substitui o vínculo à personagem fixada');
});

test('Identidade de voz fixada não exige asset de mídia extra quando só a referência é necessária', () => {
  const audio = {...simulatedModel('audio'),required_inputs:['identity' as const]};
  const value = request({operation:'audio',route:null,shot:null,input_assets:[],references:[{id:'voice_fixture',version:1}],parameters:{text:'Fala de ensaio',voice_reference:'voice_fixture'}});
  assert.deepEqual(validateModelRequest(audio,value),[]);
  assert.ok(validateModelRequest(audio,{...value,references:[]}).some(i => i.code === 'identity_missing'));
  const avatar = simulatedModel('avatar');
  const avatarRequest = request({operation:'avatar',route:'avatar',references:value.references,parameters:{type:'avatar',avatar_id:'fixture_avatar',audio_url:'https://example.com/audio.wav'}});
  assert.ok(validateModelRequest(avatar,avatarRequest).some(i => i.code === 'inputs_missing'));
});

test('Animação derivada exige geração de imagem ou referência visual pronta; voz não serve como imagem', () => {
  const {input,catalog:readyCatalog,visual} = readyConfiguration();
  const animationInput = {...input,character:{...input.character,references:[]},references:[input.references[0]!],model_operations:['sim_animation','sim_audio','sim_render']};
  const missing = checkAudiovisualConfiguration(animationInput,readyCatalog);
  assert.equal(missing.allowed,false);
  assert.ok(missing.blockers.some(i => i.code === 'image_input_unconfigured'));
  assert.equal(checkAudiovisualConfiguration({...animationInput,model_operations:[...animationInput.model_operations,'sim_image']},readyCatalog).allowed,true);
  const uploaded = {...animationInput,profile:ProfileSchema.parse({...input.profile,permitted_references:[{id:visual.id,version:visual.version}]}),references:[input.references[0]!,visual]};
  assert.equal(checkAudiovisualConfiguration(uploaded,readyCatalog).allowed,true);
  assert.ok(checkAudiovisualConfiguration({...uploaded,references:[input.references[0]!,{...visual,version:2}]},readyCatalog).blockers.some(i => i.code === 'image_input_unconfigured'));
});

test('Alternativa recorrente exige schema documentado além de acesso e evidência sintética', () => {
  const {input,catalog:readyCatalog} = readyConfiguration();
  const profile = ProfileSchema.parse({...input.profile,status:'validated',calibration_scope:{article_classes:['explanation'],formats:['1920x1080@24'],evidence_refs:['fixture_calibration']}});
  readyCatalog.calibrations = [{profile:{id:profile.id,version:profile.version},recipe:'explanation',recipe_version:1,model_operation:'sim_image',shot_classes:['editorial_illustration'],article_classes:['explanation'],formats:['1920x1080@24'],evidence_refs:['fixture_calibration']}];
  const definition = readyCatalog.shot_classes.find(c => c.id === 'avatar_on_camera')!;
  const scope = {mode:'recurring' as const,article_class:'explanation',format:'1920x1080@24'};
  assert.equal(permittedFallbacks(definition,profile,readyCatalog,scope).length,1);
  const image = readyCatalog.models.find(m => m.id === 'sim_image')!;
  image.documentation = 'catalog_only';
  assert.equal(permittedFallbacks(definition,profile,readyCatalog,scope).length,0);
});
