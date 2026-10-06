import { ArticleListSchema, UniverseSchema, ProfilesSchema } from './configuration.js';

export const CONFIGURATION_FIXTURE_NOTICE = 'SIMULAÇÃO S1 — dados e referências fictícios; sem mídia, conexão ou qualidade validada.';
const meta = (id: string) => ({ id,version:1,created_at:'2026-10-04T12:00:00Z',author:'fixture_operator',changes:[] });
const character = { ...meta('character_s1_fixture'),status:'confirmed',name:'Personagem de demonstração',
  bible:{original_uri:'/api/bibles/'+'a'.repeat(64),original_hash:'a'.repeat(64),interpretation:CONFIGURATION_FIXTURE_NOTICE,interpretation_confirmed:true},
  references:[],voice:null,authorized_variations:[] };
const reference = { ...meta('voice_s1_fixture'),status:'pending',kind:'voice',name:'Voz candidata fictícia',asset_refs:[],rules:[CONFIGURATION_FIXTURE_NOTICE],usage_permission:'unknown' };
export const universeConfigurationFixture = UniverseSchema.parse({characters:[character],references:[reference]});
export const articlesConfigurationFixture = ArticleListSchema.parse({total:2,offset:0,limit:25,items:[
  {article:{...meta('article_s1_fixture'),status:'available',title:'Artigo de demonstração S1',source:{kind:'manual',url:null,captured_at:'2026-10-04T12:00:00Z'},
    source_author:'Autora fictícia',character:{id:character.id,version:1},content:CONFIGURATION_FIXTURE_NOTICE,content_hash:'a'.repeat(64),complete:true,
    segments:[{id:'segment_1',text:CONFIGURATION_FIXTURE_NOTICE}],source_images:[]},eligibility:{allowed:true,calibration_only:false,blockers:[]},needs_capture_review:false},
  {article:{...meta('article_incomplete_s1_fixture'),status:'incomplete',title:'Captura incompleta de demonstração',source:{kind:'url',url:'https://example.com/fixture',captured_at:'2026-10-04T12:00:00Z'},
    source_author:'Autoria não identificada',character:null,content:CONFIGURATION_FIXTURE_NOTICE,content_hash:'b'.repeat(64),complete:false,
    segments:[{id:'segment_1',text:CONFIGURATION_FIXTURE_NOTICE}],source_images:[]},eligibility:{allowed:false,calibration_only:false,blockers:[{code:'source_incomplete',message:'A captura precisa de revisão.',next_action:'Corrigir o conteúdo.',required:true}]},needs_capture_review:true},
]});
export const profilesConfigurationFixture = ProfilesSchema.parse({items:[{...meta('profile_s1_fixture'),status:'draft',name:'Perfil de demonstração S1',
  character:{id:character.id,version:1},language:'pt-BR',target_seconds:null,recipe:null,permitted_shot_classes:[],permitted_references:[],voice:null,delivery:null,budget:null,calibration_scope:null}]});
