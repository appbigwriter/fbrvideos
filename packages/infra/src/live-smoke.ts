import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { ArticleSchema, CharacterSchema, ProfileSchema, PipelineCatalogSchema, EligibilitySchema } from '@fbr/contracts';

const base = 'http://127.0.0.1:3001';
const evidenceFile = 'var/s1-http-evidence.json';
async function call(path: string, body?: unknown) {
  const response = await fetch(`${base}${path}`, body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data: unknown = await response.json();
  return {status:response.status,data};
}
const command = (data: unknown, expected_version: number|null = null) => ({command_id:randomUUID(),expected_version,reason:'Ensaio HTTP sintético S1',data});
if (process.env.SMOKE_VERIFY_EXISTING === '1') {
  const saved = JSON.parse(await readFile(evidenceFile,'utf8')) as {article_id:string;version:number;title:string};
  const latest = await call(`/api/articles/${saved.article_id}`);
  assert.equal(latest.status,200); const article = ArticleSchema.parse(latest.data);
  assert.equal(article.version,saved.version); assert.equal(article.title,saved.title);
  const original = await call(`/api/articles/${saved.article_id}?version=1`);
  assert.equal(ArticleSchema.parse(original.data).title,'Artigo sintético de validação HTTP');
  console.log('Persistência HTTP após reinício da API confirmada; revisão anterior preservada.');
} else {
  assert.equal((await call('/health')).status,200);
  const characterInput = command({name:'Personagem sintética HTTP',status:'confirmed',bible_original:'# Bible sintético\r\nApenas teste local.',
    interpretation:'Interpretação sintética confirmada para ensaio técnico.',interpretation_confirmed:true,references:[],voice:null,authorized_variations:[]});
  const createdCharacter = await call('/api/characters',characterInput); assert.equal(createdCharacter.status,201);
  const character = CharacterSchema.parse(createdCharacter.data);
  const replay = await call('/api/characters',characterInput); assert.deepEqual(replay,createdCharacter);
  const articleData = {title:'Artigo sintético de validação HTTP',source_author:'Autora sintética',content:'Fonte fictícia para testar somente a persistência e o protocolo HTTP.',
    complete:true,character:{id:character.id,version:1}};
  const created = await call('/api/articles',command(articleData)); assert.equal(created.status,201);
  const article = ArticleSchema.parse(created.data);
  const edits = await Promise.all(['Revisão sintética A','Revisão sintética B'].map(title => call(`/api/articles/${article.id}/revisions`,command({...articleData,title},1))));
  assert.deepEqual(edits.map(r => r.status).sort(),[200,409]);
  const latest = ArticleSchema.parse((await call(`/api/articles/${article.id}`)).data); assert.equal(latest.version,2);
  const bible = await fetch(`${base}/api/bibles/${character.bible.original_hash}`); assert.equal(await bible.text(),'# Bible sintético\r\nApenas teste local.');
  const profileResult = await call('/api/profiles',command({name:'Perfil sintético HTTP',status:'draft',character:{id:character.id,version:1},language:'pt-BR',
    target_seconds:null,recipe:null,permitted_shot_classes:[],permitted_references:[],voice:null,delivery:null,budget:null,calibration_scope:null}));
  assert.equal(profileResult.status,201); const profile = ProfileSchema.parse(profileResult.data);
  const catalog = await call('/api/pipeline/catalog'); assert.equal(catalog.status,200); PipelineCatalogSchema.parse(catalog.data);
  const check = await call(`/api/profiles/${profile.id}/audiovisual-check`,{profile_version:1,article:{id:article.id,version:2},mode:'calibration',
    article_class:'explanation',format:'1920x1080@24',model_operations:[]});
  assert.equal(check.status,200); assert.equal(EligibilitySchema.parse(check.data).allowed,false);
  assert.equal((await call(`/api/profiles/${profile.id}/audiovisual-check`,{profile_version:99,article:{id:article.id,version:2},mode:'calibration',article_class:'explanation',format:'1920x1080@24',model_operations:[]})).status,404);
  assert.equal((await fetch(`${base}/api/articles`,{headers:{Origin:'https://untrusted.example'}})).status,403);
  assert.equal((await call('/api/articles',{invalid:true})).status,400);
  await mkdir('var',{recursive:true});
  await writeFile(evidenceFile,JSON.stringify({checked_at:new Date().toISOString(),article_id:article.id,version:latest.version,title:latest.title,
    checks:['health','create','replay','concurrent_CAS','original_bible','draft_profile','catalog','readiness_blocked','exact_revision_404','origin_403','invalid_400']},null,2));
  console.log('HTTP real: cadastro, replay, CAS concorrente, Bible original, catálogo, bloqueios e erros confirmados.');
}
