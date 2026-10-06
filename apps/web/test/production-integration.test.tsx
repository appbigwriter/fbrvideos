import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { articleFixture, profileFixture } from '@fbr/contracts/fixtures';
import { dossierPresentationFixture } from '@fbr/contracts/planning-fixtures';
import { ProductionDetailSchema } from '@fbr/contracts';
import { productionSetup, dossierPresentation } from '../src/pages/ProductionPresentation.js';
import { CreationForm } from '../src/pages/ProductionsConnected.js';
import { DossierPanel } from '../src/components/dossier/DossierPanel.js';

test('Criação preserva revisões e envia overrides; campos vazios usam perfil',()=>{
  const setup=productionSetup(articleFixture,profileFixture,' Ensaio ','calibration','75','  Sem neon  \n\nSem placas');
  assert.equal(setup.summary.can_submit,true);
  assert.deepEqual(setup.request?.article,{id:articleFixture.id,version:articleFixture.version});
  assert.deepEqual(setup.request?.profile,{id:profileFixture.id,version:profileFixture.version});
  assert.deepEqual(setup.request?.overrides,{target_seconds:75,avoid:['Sem neon','Sem placas']});
  assert.equal(setup.request?.name,'Ensaio');
  assert.equal(productionSetup(articleFixture,profileFixture,'Ensaio','calibration','','').request?.overrides,undefined);
});
test('Criação bloqueia fonte incompleta, recorrência sem validação e duração inválida',()=>{
  assert.equal(productionSetup({...articleFixture,complete:false},profileFixture,'Ensaio','calibration','','').request,null);
  assert.equal(productionSetup(articleFixture,{...profileFixture,status:'draft'},'Ensaio','recurring','','').request,null);
  for(const duration of ['0','-1','Infinity','abc']) assert.equal(productionSetup(articleFixture,profileFixture,'Ensaio','calibration',duration,'').request,null);
  const html=renderToStaticMarkup(<MemoryRouter><CreationForm article={articleFixture} profiles={[profileFixture]}/></MemoryRouter>);
  assert.match(html,/production-setup-panel/);
  assert.match(html,/Opções avançadas de planejamento/);
  assert.match(html,/cota da conta/);
  assert.match(html,/Criar produção e planejar/);
});
test('Dossiê usa snapshot exato e recusa revisão divergente',()=>{
  // O projetor exige apenas os campos efetivamente lidos, sem buscar cadastros atuais.
  const input={dossier:dossierPresentationFixture.dossier,snapshot:{article:dossierPresentationFixture.article}};
  const detail=input as unknown as ReturnType<typeof ProductionDetailSchema.parse>;
  assert.equal(dossierPresentation(detail).data?.article.version,dossierPresentationFixture.article.version);
  const mismatched={...input,snapshot:{article:{...input.snapshot.article,version:input.snapshot.article.version+1}}};
  assert.equal(dossierPresentation(mismatched as unknown as typeof detail).data,null);
  assert.match(dossierPresentation(mismatched as unknown as typeof detail).error!,/revisão/);
});
test('Fontes editoriais/ausentes não recebem aprovação ou texto de revisão diferente',()=>{
  const data=structuredClone(dossierPresentationFixture);
  const speech=data.dossier.blocks[0]!.speeches[0]!;
  speech.kind='afirmacao_factual';
  speech.sources=[{kind:'article',document:{id:data.article.id,version:data.article.version+1},segment_id:data.article.segments[0]!.id},
    {kind:'approved_editorial',document:{id:'editorial_fixture',version:1},segment_id:'external_segment'}];
  let html=renderToStaticMarkup(<DossierPanel data={data} loading={false} error={null} onRetry={()=>{}}/>);
  assert.match(html,/Fonte não disponível nesta apresentação/);
  assert.doesNotMatch(html,/Aprovação editorial/);
  assert.doesNotMatch(html,/source-quote/);
  speech.sources=[];
  html=renderToStaticMarkup(<DossierPanel data={data} loading={false} error={null} onRetry={()=>{}}/>);
  assert.doesNotMatch(html,/Transição editorial sem afirmação factual/);
  speech.kind='transicao_convite';
  html=renderToStaticMarkup(<DossierPanel data={data} loading={false} error={null} onRetry={()=>{}}/>);
  assert.match(html,/Transição editorial sem afirmação factual/);
});
