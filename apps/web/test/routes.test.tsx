import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../src/AppRoutes.js';
import { ArticleListSchema, UniverseSchema, ProfilesSchema, selectedUniverseRecord } from '@fbr/contracts';
import { articlesConfigurationFixture, universeConfigurationFixture, profilesConfigurationFixture } from '@fbr/contracts/fixtures';

test('AG-01 integrado: todas as rotas apresentam a página correta e um H1', () => {
  for (const [url,title] of [['/','Início'],['/artigos','Artigos'],['/artigos/article_1','Detalhe do artigo'],['/producoes','Produções'],
    ['/producoes/nova?artigo=article_1','Criar produção'],['/producoes/production_1','Acompanhamento da produção'],
    ['/producoes/production_1/revisao','Revisão'],['/producoes/production_1/entrega','Entrega'],['/perfis','Perfis de produção'],
    ['/universo','Universo'],['/configuracoes','Configurações']]) {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={[url!]}><AppRoutes /></MemoryRouter>);
    assert.equal((html.match(/<h1\b/g) ?? []).length,1,url);
    assert(html.includes(`>${title}</h1>`),url);
    assert(html.includes('Pular para o conteúdo'),url);
    assert(html.includes('FBR Videos'),url);
  }
});
test('Fixtures AG-02/03/04 usam contratos publicados e seleção de revisão exata', () => {
  ArticleListSchema.parse(articlesConfigurationFixture);
  UniverseSchema.parse(universeConfigurationFixture);
  ProfilesSchema.parse(profilesConfigurationFixture);
  const character = universeConfigurationFixture.characters[0]!;
  assert.equal(selectedUniverseRecord(universeConfigurationFixture,{kind:'character',ref:{id:character.id,version:2}}),null);
  assert.equal(selectedUniverseRecord(universeConfigurationFixture,{kind:'character',ref:{id:character.id,version:1}})?.id,character.id);
});
