import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {reviewViewFixtures,deliveryViewFixtures} from '@fbr/contracts/review-fixtures';
import {SceneReviewPanel as ReviewPanelFallback} from '../src/components/review/SceneReviewPanel.js';
import {DeliveryPanel as DeliveryPanelFallback} from '../src/components/delivery/DeliveryPanel.js';
test('Revisão apresenta timecodes medidos e impede apontamento sem prévia disponível',()=>{
  const props={data:reviewViewFixtures.unavailable,loading:false,error:null,pending:false,command_error:null,selected_shot:null,current_seconds:0,
    category:'comment' as const,comment:'',can_submit:false,submit_reason:'Prévia indisponível.',onRetry(){},onSelectShot(){},onCategoryChange(){},onCommentChange(){},onSubmit(){}};
  const empty=renderToStaticMarkup(<ReviewPanelFallback {...props}/>);assert.match(empty,/<textarea[^>]*disabled/);assert.match(empty,/<button[^>]*type="submit"[^>]*disabled/);
  const html=renderToStaticMarkup(<ReviewPanelFallback {...props} data={reviewViewFixtures.review} selected_shot={reviewViewFixtures.review.scenes[0]!.ref} current_seconds={3.25}/>);
  assert.match(html,/3\.25s/);assert.match(html,/0\.00s – 8\.00s/);assert.match(html,/aria-pressed="true"/);
  assert.equal(html.includes('Assisti integralmente'),false);
});
test('Entrega indisponível não fabrica download e prévia não habilita exportação aprovada',()=>{
  const props={loading:false,error:null,pending:false,command_error:null,onRetry(){},onExport(){}};
  const unavailable=renderToStaticMarkup(<DeliveryPanelFallback {...props} data={deliveryViewFixtures.unavailable}/>);
  assert.equal(unavailable.includes('download=""'),false);assert.match(unavailable,/Entrega ainda indisponível/);
  const preview=renderToStaticMarkup(<DeliveryPanelFallback {...props} data={deliveryViewFixtures.preview}/>);
  assert.match(preview,/Prévia para revisão/);assert.match(preview,/Baixar prévia/);assert.match(preview,/<button[^>]*disabled[^>]*>Preparar pacote aprovado/);
});
