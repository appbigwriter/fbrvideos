import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { productionFixture } from '@fbr/contracts/fixtures';
import { progressPresentation } from '../src/pages/ProductionPresentation.js';
import { ProductionProgressPanel, type ProductionProgressPanelProps } from '../src/components/progress/ProductionProgressPanel.js';

const noop=()=>{};
const props=(data:ProductionProgressPanelProps['data']):ProductionProgressPanelProps=>({data,loading:false,error:null,pending:false,command_error:null,
  onRetry:noop,onRefresh:noop,onPause:noop,onResume:noop,onCancel:noop});

test('Acompanhamento respeita flags da API, preserva revisão e limita dados à apresentação',()=>{
  const production={...productionFixture,status:'paused' as const};
  // Flags explícitas, mesmo quando não seriam inferidas do status: a API é a autoridade.
  const data=progressPresentation({production,actions:{pause:true,resume:false,cancel:false}});
  assert.deepEqual(data.ref,{id:production.id,version:production.version});
  assert.equal(data.actions.pause.enabled,true);
  assert.equal(data.actions.pause.reason,null);
  assert.equal(data.actions.resume.enabled,false);
  assert.match(data.actions.resume.reason!,/servidor/);
  assert.equal('snapshot' in data,false);
  assert.equal('bible_original' in data,false);
  const html=renderToStaticMarkup(<ProductionProgressPanel {...props(data)}/>);
  assert.match(html,/Pausada/);
  assert.match(html,/disabled=""[^>]*>Retomar/);
  assert.doesNotMatch(html,/disabled=""[^>]*>Pausar/);
});

test('Custo desconhecido difere de zero e compromissos não são apresentados como confirmados',()=>{
  const data=progressPresentation({production:{...productionFixture,costs:{...productionFixture.costs,
    estimated_minor:null,committed_minor:1234,confirmed_minor:0}},actions:{pause:false,resume:false,cancel:false}});
  let html=renderToStaticMarkup(<ProductionProgressPanel {...props(data)}/>);
  assert.match(html,/Estimativa indisponível/);
  assert.match(html,/Comprometido com mídia[\s\S]*?12,34/);
  assert.match(html,/Confirmado de mídia[\s\S]*?0,00/);
  assert.match(html,/cota da conta/);
  data.costs={...data.costs,estimated_minor:0};
  html=renderToStaticMarkup(<ProductionProgressPanel {...props(data)}/>);
  assert.doesNotMatch(html,/Estimativa indisponível/);
});

test('Comando pendente bloqueia todos os controles e conflito conserva dados exibidos',()=>{
  const data=progressPresentation({production:productionFixture,actions:{pause:true,resume:true,cancel:true}});
  const html=renderToStaticMarkup(<ProductionProgressPanel {...props(data)} pending command_error="A produção mudou. Recarregue antes de enviar o comando."/>);
  const buttons=html.match(/<button[^>]*>/g)!;
  assert.equal(buttons.length,4);
  assert.ok(buttons.every(button=>button.includes('disabled=""')));
  assert.match(html,/A produção mudou/);
  assert.ok(html.includes(productionFixture.name));
  assert.match(html,/Consumo e Limites/);
  const error=renderToStaticMarkup(<ProductionProgressPanel {...props(null)} error="Falha de carga"/>);
  assert.match(error,/Tentar novamente/);
  assert.match(error,/Falha de carga/);
});
