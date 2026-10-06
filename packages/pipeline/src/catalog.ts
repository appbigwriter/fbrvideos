import { CONTRACT_VERSION, PipelineCatalogSchema, type ModelOperation, type Recipe } from '@fbr/contracts';

const imageSource = 'https://open.higgsfield.ai/models/higgsfield-ai/soul/standard/api-reference';
const textVideoSource = 'https://open.higgsfield.ai/models/bytedance/seedance-2.0/text-to-video/api-reference';
const imageVideoSource = 'https://open.higgsfield.ai/models/bytedance/seedance-2.0/image-to-video/api-reference';
const rule = (name: string, type: 'string'|'integer'|'number'|'boolean', required = false,
  choices: (string|number|boolean)[] = [], minimum: number|null = null, maximum: number|null = null, nullable = false) =>
  ({ name, type, required, choices, minimum, maximum, nullable });
const model = (data: Pick<ModelOperation, 'id'|'provider'|'model'|'operation'|'route'> & Partial<ModelOperation>): ModelOperation => ({
  documentation: 'catalog_only', documentation_url: 'https://open.higgsfield.ai/explore', reviewed_on: '2026-10-04',
  account_access: 'unverified', runtime: 'not_implemented', official_audio: 'unknown', references: 'unknown', composition: 'unknown',
  minimum_seconds: null, maximum_seconds: null, parameters: [], required_inputs: [], evidence_refs: [],
  notes: ['Candidato técnico; acesso e qualidade audiovisual não ensaiados.'], ...data,
});
const resolutions = ['480p', '720p', '1080p', '4k'];
const duration = rule('duration', 'integer', false, [], 4, 15);
const recipe = (id: string, label: string, articleClass: string, roles: string[], personal = false): Recipe => ({
  id, version: 1, label, article_classes: [articleClass], state: 'candidate', requires_source_personal_account: personal,
  sections: roles.map(role => ({ role, shot_classes: ['avatar_on_camera', 'editorial_illustration'] })),
});

// Snapshot inicial e extensível, não inventário completo nem seleção final de fornecedores.
export function getPipelineCatalog() {
  return PipelineCatalogSchema.parse({ contract_version: CONTRACT_VERSION, version: '0.1.0',
    recipes: [
      recipe('explanation', 'Explicação', 'explanation', ['abertura', 'contexto', 'argumentos', 'conclusão']),
      recipe('recommendation_list', 'Lista de recomendações', 'recommendation_list', ['abertura', 'itens', 'síntese']),
      recipe('reflection', 'Reflexão e opinião', 'reflection', ['questão', 'perspectiva', 'conclusão']),
      recipe('personal_account', 'Relato pessoal sustentado pela fonte', 'personal_account', ['contexto', 'experiência', 'aprendizado'], true),
      { ...recipe('demonstrative_tutorial', 'Tutorial demonstrativo', 'demonstrative_tutorial', ['contexto', 'passos', 'conclusão']),
        state: 'experimental', sections: [{ role: 'passos', shot_classes: ['simple_interaction'] }] },
    ],
    shot_classes: [
      { id: 'avatar_on_camera', label: 'Autora em câmera', routes: ['avatar'], required_reference_kinds: ['character','voice'],
        fallbacks: [{ shot_class: 'editorial_illustration', route: 'still_image', requires_direction_review: true }], constraints: ['Áudio oficial externo; identidade e sincronismo precisam de avaliação.'] },
      { id: 'simple_character_motion', label: 'Movimento simples da personagem', routes: ['animated_scene','still_image'], required_reference_kinds: ['character'],
        fallbacks: [{ shot_class: 'simple_character_motion', route: 'still_image', requires_direction_review: true }], constraints: ['Sem fala gerada nem ação complexa; continuidade deve ser avaliada.'] },
      { id: 'detail_without_manipulation', label: 'Detalhe sem manipulação', routes: ['still_image','animated_scene','existing_asset'], required_reference_kinds: ['prop'],
        fallbacks: [{ shot_class: 'detail_without_manipulation', route: 'still_image', requires_direction_review: true }], constraints: ['Sem demonstrar manipulação de objeto.'] },
      { id: 'environment_without_character', label: 'Ambiente sem personagem', routes: ['still_image','animated_scene','existing_asset'], required_reference_kinds: ['environment'],
        fallbacks: [{ shot_class: 'environment_without_character', route: 'still_image', requires_direction_review: true }], constraints: ['Ambiente coerente com a direção aprovada.'] },
      { id: 'editorial_illustration', label: 'Ilustração editorial', routes: ['still_image','animated_scene','existing_asset'], required_reference_kinds: [],
        fallbacks: [{ shot_class: 'editorial_illustration', route: 'still_image', requires_direction_review: true }], constraints: ['Não representar ilustração como evidência factual.'] },
      { id: 'simple_interaction', label: 'Interação simples', routes: ['animated_scene'], required_reference_kinds: ['character','prop'],
        fallbacks: [{ shot_class: 'detail_without_manipulation', route: 'still_image', requires_direction_review: true }], constraints: ['Experimental; ação específica exige calibração e revisão de função narrativa.'] },
    ],
    models: [
      model({ id: 'hf_soul_standard_image', provider: 'higgsfield', model: 'higgsfield-ai/soul/standard', operation: 'image', route: 'still_image',
        documentation: 'schema_reviewed', documentation_url: imageSource, references: 'unsupported', official_audio: 'unsupported', composition: 'unsupported',
        parameters: [rule('prompt','string',true), rule('seed','integer',false,[],1,1000000,true), rule('style_id','string',false,[],null,null,true),
          rule('batch_size','integer',false,[1,4]),rule('resolution','string',false,['720p','1080p']),
          rule('aspect_ratio','string',false,['9:16','16:9','4:3','3:4','1:1','2:3','3:2']), rule('enhance_prompt','boolean'),rule('style_strength','number',false,[],0,1)],
        notes: ['Schema somente texto/estilo: não assumir preservação de identidade nem injetar referências sem campo documentado.'] }),
      model({ id: 'hf_seedance2_text_animation', provider: 'higgsfield', model: 'bytedance/seedance-2.0/text-to-video', operation: 'animation', route: 'animated_scene',
        documentation: 'schema_reviewed', documentation_url: textVideoSource, references: 'unsupported', official_audio: 'unsupported', composition: 'unsupported', minimum_seconds: 4, maximum_seconds: 15,
        parameters: [rule('prompt','string',true),duration,rule('resolution','string',false,resolutions),
          rule('aspect_ratio','string',false,['16:9','4:3','1:1','3:4','9:16','21:9']),rule('generate_audio','boolean',true,[false])],
        notes: ['Política FBR exige generate_audio=false explícito; narração oficial é montada separadamente.'] }),
      model({ id: 'hf_seedance2_image_animation', provider: 'higgsfield', model: 'bytedance/seedance-2.0/image-to-video', operation: 'animation', route: 'animated_scene',
        documentation: 'schema_reviewed', documentation_url: imageVideoSource, references: 'supported', official_audio: 'unsupported', composition: 'unsupported', minimum_seconds: 4, maximum_seconds: 15,
        required_inputs: ['image'], parameters: [rule('prompt','string'),duration,rule('image_url','string',true),rule('end_image_url','string'),
          rule('resolution','string',false,resolutions),rule('generate_audio','boolean',true,[false])],
        notes: ['Imagem inicial versionada e permitida; image_url será resolvida pelo servidor, sem assumir suporte a múltiplas referências.'] }),
      model({ id: 'heygen_audio_avatar', provider: 'heygen', model: 'v3/videos:audio-avatar', operation: 'avatar', route: 'avatar',
        documentation: 'schema_reviewed', documentation_url: 'https://developers.heygen.com/audio-to-video', official_audio: 'supported', references: 'supported',
        maximum_seconds: 1800, required_inputs: ['official_audio','identity'],
        parameters: [rule('type','string',true,['avatar']),rule('avatar_id','string',true),rule('audio_url','string',true),
          rule('resolution','string',false,['720p','1080p']),rule('aspect_ratio','string',false,['auto','16:9','9:16','1:1'])],
        notes: ['Subconjunto conservador da rota documentada; voz oficial externa, sem script/voice_id substitutos. Look/engine dependem do ensaio.'] }),
      model({ id: 'heygen_official_voice', provider: 'heygen', model: 'v3/voices/speech', operation: 'audio', route: null,
        documentation:'schema_reviewed',reviewed_on:'2026-10-06',documentation_url: 'https://developers.heygen.com/reference/generate-speech', required_inputs: ['identity'],references:'supported',
        parameters:[rule('text','string',true),rule('voice_id','string',true),rule('input_type','string',false,['text']),rule('speed','number',false,[],0.5,2),
          rule('language','string'),rule('locale','string'),rule('engine','string',false,['starfish','orca','elevenlabs','elevenlabs_v3']),rule('force_regenerate','boolean')],
        notes: ['Subconjunto conservador revisado; voz/engine da conta, custo confirmado e qualidade continuam pendentes. Preferências salvas não são substituídas automaticamente.'] }),
      model({ id: 'hf_kling3_candidate', provider: 'higgsfield', model: 'Kling 3.0', operation: 'animation', route: 'animated_scene' }),
      model({ id: 'hf_seedance25_candidate', provider: 'higgsfield', model: 'Seedance 2.5', operation: 'animation', route: 'animated_scene' }),
      model({ id: 'hf_soul2_candidate', provider: 'higgsfield', model: 'Soul 2', operation: 'image', route: 'still_image' }),
      model({ id: 'hf_marketing_image_candidate', provider: 'higgsfield', model: 'Marketing Studio Image', operation: 'image', route: 'still_image' }),
    ], calibrations: [],
  });
}
