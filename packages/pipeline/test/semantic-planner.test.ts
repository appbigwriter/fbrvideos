import test from 'node:test';
import assert from 'node:assert/strict';
import { ProductionSnapshotSchema,SemanticPlanSchema, type InferenceJournal } from '@fbr/contracts';
import { articleFixture,profileFixture,dossierFixture,universeConfigurationFixture } from '@fbr/contracts/fixtures';
import { canonical,sha256 } from '@fbr/domain';
import { SemanticPlanner } from '../src/semantic-planner.js';
import { PlanningBlocked } from '../src/planner.js';
import { getPipelineCatalog } from '../src/catalog.js';
function setup(){
  const bible='# Bible sintético: comunicação clara; não inventar experiências.';
  const article={...articleFixture,content_hash:sha256(articleFixture.content)};
  const profile={...profileFixture,recipe:'explanation'};
  const character={...universeConfigurationFixture.characters[0]!,id:profile.character.id,
    bible:{...universeConfigurationFixture.characters[0]!.bible,original_hash:sha256(bible)}};
  const payload={production_id:'semantic_fixture',captured_at:'2026-10-04T12:00:00Z',request:{contract_version:'0.1.0',command_id:'create',name:'Ensaio semântico',mode:'calibration',article:{id:article.id,version:1},profile:{id:profile.id,version:1}},article,profile,character,
    bible_original:bible,references:[],catalog:getPipelineCatalog()};
  const input=ProductionSnapshotSchema.parse({...payload,hash:sha256(canonical(payload))});
  const plan=SemanticPlanSchema.parse({recipe:'explanation',briefing:dossierFixture.briefing,blocks:dossierFixture.blocks.map(b=>({...b,
    speeches:b.speeches.map(s=>({...s,text:'Eu recomendo ajustar as notificações para reduzir interrupções.',kind:'opiniao_editorial'}))})),
    shots:dossierFixture.shots.map(({version,created_at,author,changes,status,...shot})=>({...shot,
      references:{character:null,environment:null,wardrobe:null,props:[],style:null,composition:null},duration:{target_seconds:8,resolved_seconds:null}})),personal_attributions:[]});
  return{input,plan,review:{result:'pass',findings:[],source_coverage:['source_01']}};
}
const journal:InferenceJournal={run:(_key,_hash,run)=>run()};
function planner(values:unknown[]){let calls=0;return{engine:new SemanticPlanner({async run(){return{value:values[calls++],usage:{input_tokens:10,output_tokens:20}};}},journal),calls:()=>calls};}
const ref={id:'semantic_fixture',version:2};
test('Planejador semântico reescreve com fontes e audita; nenhum sinal vira aprovação ou mídia',async()=>{
  const s=setup(),p=planner([s.plan,s.review]),dossier=await p.engine.plan(s.input,ref);
  assert.equal(p.calls(),2);assert.match(dossier.blocks[0]!.speeches[0]!.text,/^Eu recomendo/u);
  assert.equal(dossier.approvals.length+dossier.evaluations.length+dossier.assets.length+dossier.jobs.length,0);
  assert.ok(dossier.pending_issues.some(i=>i.code==='human_editorial_review'&&i.required));
  assert.match(dossier.changes[0]!.reason,/20\/40/u);
});
test('Fonte de outra versão, rota fora da classe e evidência pessoal fabricada falham antes de auditar',async()=>{
  const s=setup();const variants=[
    {...s.plan,blocks:s.plan.blocks.map(b=>({...b,speeches:b.speeches.map(sp=>({...sp,sources:[{kind:'article',document:{...sp.sources[0]!.document,version:99},segment_id:'source_01'}]}))}))},
    {...s.plan,shots:s.plan.shots.map(shot=>({...shot,route:'avatar'}))},
    {...s.plan,blocks:s.plan.blocks.map(b=>({...b,speeches:b.speeches.map(sp=>({...sp,kind:'experiencia_pessoal',text:'Eu visitei Paris.'}))})),
      personal_attributions:[{speech_id:'speech_01',segment_id:'source_01',quote:'Eu visitei Paris.',speaker:'article_author'}]},
  ];
  for(const variant of variants){const p=planner([variant,s.review]);await assert.rejects(p.engine.plan(s.input,ref),PlanningBlocked);assert.equal(p.calls(),1);}
});
test('Auditoria rejeitada ou cobertura insuficiente não persiste conclusão',async()=>{
  const s=setup();for(const review of [{...s.review,result:'reject',findings:[{code:'invented',message:'Afirmação ausente.',speech_id:'speech_01'}]},
    {...s.review,source_coverage:[]},{...s.review,result:'pass',findings:[{code:'contradiction',message:'Contradição.',speech_id:null}]}])
    await assert.rejects(planner([s.plan,review]).engine.plan(s.input,ref),PlanningBlocked);
});
test('Erro OAuth não faz fallback extrativo nem retry silencioso',async()=>{
  let calls=0;const engine=new SemanticPlanner({async run(){calls++;throw new Error('oauth_timeout_unknown');}},journal);
  await assert.rejects(engine.plan(setup().input,ref),e=>e instanceof PlanningBlocked&&e.issues[0]!.code==='oauth_timeout_unknown');
  assert.equal(calls,1);
});
test('Pausa após planejamento interrompe a chamada de auditoria e não apresenta dossiê completo',async()=>{
  const s=setup();let calls=0,checks=0;
  const engine=new SemanticPlanner({async run(){calls++;return{value:s.plan,usage:{input_tokens:10,output_tokens:20}};}},journal,async()=>++checks===1);
  await assert.rejects(engine.plan(s.input,ref),e=>e instanceof PlanningBlocked&&e.issues[0]!.code==='planning_superseded');
  assert.equal(calls,1);
});
