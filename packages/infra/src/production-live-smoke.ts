import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { ProductionDetailSchema,ArticleSchema,ProfileSchema,CharacterSchema } from '@fbr/contracts';
import { canonical,sha256 } from '@fbr/domain';
const id=process.env.LIVE_PRODUCTION_ID;
if(!id||!/^[-a-zA-Z0-9_.:]+$/.test(id))throw new Error('Defina LIVE_PRODUCTION_ID para uma produção local de ensaio.');
const base='http://127.0.0.1:3001/api';
async function get(path:string){const response=await fetch(`${base}${path}`);assert.equal(response.status,200);return response.json() as Promise<unknown>;}
const detail=ProductionDetailSchema.parse(await get(`/productions/${id}`));
const {hash,...snapshot}=detail.snapshot;assert.equal(hash,sha256(canonical(snapshot)));
assert.deepEqual(ArticleSchema.parse(await get(`/articles/${snapshot.article.id}?version=${snapshot.article.version}`)),snapshot.article);
assert.deepEqual(ProfileSchema.parse(await get(`/profiles/${snapshot.profile.id}?version=${snapshot.profile.version}`)),snapshot.profile);
assert.deepEqual(CharacterSchema.parse(await get(`/characters/${snapshot.character.id}?version=${snapshot.character.version}`)),snapshot.character);
const bible=await fetch(`${base}/bibles/${snapshot.character.bible.original_hash}`);assert.equal(await bible.text(),snapshot.bible_original);
assert.equal(detail.events.length,detail.production.version);
const latestArticle=ArticleSchema.parse(await get(`/articles/${snapshot.article.id}`));
const latestCharacter=CharacterSchema.parse(await get(`/characters/${snapshot.character.id}`));
await mkdir('var',{recursive:true});await writeFile('var/s2-http-evidence.json',JSON.stringify({checked_at:new Date().toISOString(),production_id:id,
  production_version:detail.production.version,events:detail.events.length,snapshot_hash:hash,article_version_fixed:snapshot.article.version,
  article_version_current:latestArticle.version,character_version_fixed:snapshot.character.version,character_version_current:latestCharacter.version,
  checks:['snapshot_hash','exact_article','exact_profile','exact_character','original_bible','event_sequence']},null,2));
console.log('HTTP S2: snapshot, revisões exatas, Bible original e sequência de eventos confirmados.');
