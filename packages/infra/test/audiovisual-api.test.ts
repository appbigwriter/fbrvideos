import test from 'node:test';
import assert from 'node:assert/strict';
import { ArticleSchema, CharacterSchema, ProfileSchema, ReferenceSchema } from '@fbr/contracts';
import { articlesConfigurationFixture, profilesConfigurationFixture, universeConfigurationFixture } from '@fbr/contracts/fixtures';
import { ConfigurationService, type ConfigurationRecord, type ConfigurationStore } from '@fbr/domain';
import { buildApp } from '../../../apps/api/src/app.js';

test('Diagnóstico audiovisual carrega referências da personagem na revisão fixada, sem exigir duplicação no perfil', async () => {
  // Read-only synthetic records; this does not approve assets in a real database.
  const voice = ReferenceSchema.parse({...universeConfigurationFixture.references[0],status:'approved',
    usage_permission:'allowed',asset_refs:[{id:'voice_asset_fixture',version:1}]});
  const visual = ReferenceSchema.parse({...voice,id:'visual_api_fixture',kind:'character',
    asset_refs:[{id:'visual_asset_fixture',version:1}]});
  const character = CharacterSchema.parse({...universeConfigurationFixture.characters[0],
    voice:{id:voice.id,version:1},references:[{id:visual.id,version:1}]});
  const article = ArticleSchema.parse(articlesConfigurationFixture.items[0]!.article);
  const profile = ProfileSchema.parse({...profilesConfigurationFixture.items[0],voice:{id:voice.id,version:1},
    recipe:'explanation',permitted_shot_classes:['avatar_on_camera'],permitted_references:[]});
  const records = new Map<string,ConfigurationRecord>([
    [`characters:${character.id}:1`,character],[`articles:${article.id}:1`,article],
    [`profiles:${profile.id}:1`,profile],[`references:${voice.id}:1`,voice],
    [`references:${visual.id}:1`,visual],
  ]);
  const reads: string[] = [];
  const store: ConfigurationStore = {
    async get(kind,id,version) { const key = `${kind}:${id}:${version}`; reads.push(key); return records.get(key) ?? null; },
    async list() { return []; }, async bible() { return null; },
    async command() { throw new Error('This fixture is read-only'); },
  };
  const app = buildApp(new ConfigurationService(store));
  try {
    const response = await app.inject({method:'POST',url:`/api/profiles/${profile.id}/audiovisual-check`,payload:{
      profile_version:1,article:{id:article.id,version:1},mode:'calibration',article_class:'explanation',
      format:'1920x1080@24',model_operations:['heygen_audio_avatar','heygen_official_voice'],
    }});
    assert.equal(response.statusCode,200);
    assert.ok(reads.includes(`references:${visual.id}:1`));
    assert.equal(response.json().blockers.some((issue:{code:string}) => issue.code === 'reference_kind_missing'),false);
    assert.equal(response.json().allowed,false,'Unimplemented/unverified providers still block execution');
  } finally { await app.close(); }
});
