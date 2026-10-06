import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath, basename } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PostgresConfigurationStore, PostgresDatabase, migrateConfiguration, type SqlClient, type SqlDatabase,
  captureArticle, isPublicAddress, validateCaptureUrl, extractArticle, type CaptureDependencies } from '../src/index.js';
import { ConfigurationService, ApplicationError, productionEligibility } from '@fbr/domain';
import { ArticleSchema, CharacterSchema, ReferenceSchema, ProfileSchema, type Article, type Character } from '@fbr/contracts';
import { buildApp } from '../../../apps/api/src/app.js';

let database: SqlDatabase;
let close: () => Promise<void>;
let service: ConfigurationService;
before(async () => {
  if (process.env.TEST_DATABASE_URL) {
    const pg = new PostgresDatabase(process.env.TEST_DATABASE_URL); database = pg; close = () => pg.close();
  } else {
    const engine = new PGlite();
    function wrap(client: Pick<PGlite, 'query' | 'exec'>): SqlClient {
      return { async query(sql,values) {
        if (values === undefined) {
          const results = await client.exec(sql); const result = results.at(-1);
          return { rows: result?.rows as Record<string,unknown>[] ?? [], rowCount: result?.affectedRows ?? 0 };
        }
        const result = await client.query<Record<string,unknown>>(sql,values);
        return { rows: result.rows, rowCount: result.affectedRows ?? 0 };
      } };
    }
    database = { ...wrap(engine), transaction: run => engine.transaction(tx => run(wrap(tx))) };
    close = () => engine.close();
  }
  await migrateConfiguration(database);
  service = new ConfigurationService(new PostgresConfigurationStore(database));
});
after(async () => close?.());
const command = <T>(data: T, expected_version: number | null = null) => ({ command_id: randomUUID(), expected_version, reason: 'Ensaio de integração S1', data });
const characterData = (bible = '# Bible original\r\nTara: voz editorial e identidade.') => ({
  name: 'Tara', status: 'confirmed', bible_original: bible, interpretation: 'Interpretação revisada.', interpretation_confirmed: true,
  references: [], voice: null, authorized_variations: [],
});
const articleData = (character: Character | null = null) => ({ title: 'Artigo de ensaio', source_author: 'Tara',
  content: 'Primeiro argumento com fonte.\n\nSegundo argumento e conclusão.', complete: true,
  character: character ? { id: character.id, version: character.version } : null });
async function createCharacter(): Promise<Character> { return CharacterSchema.parse(await service.save('characters', command(characterData()))); }

test('Bibles originais e revisões persistem; conteúdo original não é sobrescrito', async () => {
  const input = command(characterData());
  const initial = CharacterSchema.parse(await service.save('characters',input));
  assert.equal(await service.store.bible(initial.bible.original_hash), input.data.bible_original);
  const { bible_original: _original, ...data } = input.data;
  const updated = CharacterSchema.parse(await service.save('characters',command({ ...data, interpretation: 'Nova leitura revisada.' },1),initial.id));
  assert.equal(updated.version,2);
  assert.equal(updated.bible.original_hash,initial.bible.original_hash);
  assert.equal((await service.store.get('characters',initial.id,1) as Character).bible.interpretation,'Interpretação revisada.');
  const reconnected = new ConfigurationService(new PostgresConfigurationStore(database));
  assert.equal((await reconnected.store.get('characters',initial.id))?.version,2);
  await assert.rejects(database.query('UPDATE configuration_revisions SET record=record WHERE kind=$1 AND id=$2', ['characters',initial.id]), /Immutable editorial record/);
  await assert.rejects(database.query('DELETE FROM character_bibles WHERE hash=$1', [initial.bible.original_hash]), /Immutable editorial record/);
});

test('Persistência em disco mantém artigo após fechar e reabrir o PostgreSQL embarcado', async () => {
  const directory = await mkdtemp(join(tmpdir(),'fbr-s1-persistence-'));
  function embedded(engine: PGlite): SqlDatabase {
    const wrap = (client: Pick<PGlite,'query'|'exec'>): SqlClient => ({ async query(sql,values) {
      const result = values === undefined ? (await client.exec(sql)).at(-1) : await client.query(sql,values);
      return {rows: result?.rows as Record<string,unknown>[] ?? [], rowCount:result?.affectedRows ?? 0};
    } });
    return {...wrap(engine),transaction:run=>engine.transaction(tx=>run(wrap(tx)))};
  }
  let engine = new PGlite(directory);
  try {
    const firstDb = embedded(engine); await migrateConfiguration(firstDb);
    const input = command(articleData());
    const initial = await new ConfigurationService(new PostgresConfigurationStore(firstDb)).save('articles',input);
    await engine.close();
    engine = new PGlite(directory);
    const reopened = new ConfigurationService(new PostgresConfigurationStore(embedded(engine)));
    assert.deepEqual(await reopened.store.get('articles',initial.id,1),initial);
    assert.deepEqual(await reopened.save('articles',input),initial);
  } finally {
    await engine.close();
    const actual = await realpath(directory);
    if (resolvePath(actual).toLowerCase() !== resolvePath(directory).toLowerCase() || !basename(directory).startsWith('fbr-s1-persistence-')) throw new Error('Pasta de ensaio não corresponde ao diretório temporário criado.');
    await rm(actual,{recursive:true,force:true});
  }
});

test('Comando repetido não duplica registros; chave reutilizada com dados diferentes retorna conflito', async () => {
  const input = command(articleData());
  const first = await service.save('articles',input);
  const replay = await service.save('articles',{ ...input, data: { ...input.data } });
  assert.deepEqual(replay,first);
  await assert.rejects(service.save('articles',{ ...input, data: { ...input.data, title: 'Outro artigo' } }), (e: unknown) => e instanceof ApplicationError && e.code === 'conflict');
});

test('Revisões da fonte e associação preservam snapshots anteriores; captura incompleta bloqueia', async () => {
  const character = await createCharacter();
  const first = ArticleSchema.parse(await service.save('articles',command({ ...articleData(), complete: false })));
  assert.equal(first.status,'incomplete');
  const second = ArticleSchema.parse(await service.save('articles',command(articleData(character),1),first.id));
  assert.equal(second.status,'available');
  assert.equal((await service.store.get('articles',first.id,1) as Article).character,null);
  assert.equal((await service.store.get('articles',first.id,1) as Article).complete,false);
  assert.equal(new Set(second.segments.map(s => s.id)).size,2);
  await assert.rejects(service.save('articles',command(articleData(character),1),first.id), (e: unknown) => e instanceof ApplicationError && e.code === 'conflict');
  const voice = ReferenceSchema.parse(await service.save('references',command({ name:'Voz candidata', kind:'voice', status:'pending', asset_refs:[], rules:[], usage_permission:'unknown' })));
  const profile = ProfileSchema.parse(await service.save('profiles',command({ name:'Perfil candidato', status:'draft', character:{ id:character.id,version:1 }, language:'en-US',
    target_seconds:60, recipe:'Explicação', permitted_shot_classes:['editorial_illustration'], permitted_references:[], voice:{id:voice.id,version:1},
    delivery:{width:1920,height:1080,fps:30,video_codec:'h264',audio_codec:'aac',audio_sample_rate:48000,subtitle_format:'srt'},
    budget:{currency:'USD',ceiling_minor:1000,safety_margin_minor:100,max_attempts_per_job:2}, calibration_scope:null })));
  assert.equal(productionEligibility(first,profile,'calibration').allowed,false);
  assert.equal(productionEligibility(second,profile,'recurring').allowed,false);
  assert.equal(productionEligibility(second,profile,'calibration').allowed,true);
});

test('Validação de vínculos e rollback impedem entidades órfãs e validação de perfil fictícia', async () => {
  await assert.rejects(service.save('articles',command({ ...articleData(),character:{id:'missing',version:1} })), (e: unknown) => e instanceof ApplicationError && e.code === 'ineligible');
  const count = (await database.query('SELECT count(*)::integer AS count FROM configuration_commands WHERE result IS NULL')).rows[0]?.count;
  assert.equal(count,0);
  await assert.rejects(service.save('characters',command({ ...characterData(), interpretation_confirmed:false })));
  await assert.rejects(service.save('profiles',command({status:'validated'})));
  await assert.rejects(service.save('references',command({name:'Sem mídia',kind:'character',status:'approved',asset_refs:[],rules:[],usage_permission:'allowed'})));
});

test('Duas edições com a mesma revisão base não perdem atualização', async () => {
  const initial = ArticleSchema.parse(await service.save('articles',command(articleData())));
  const results = await Promise.allSettled([
    service.save('articles',command({...articleData(),title:'Edição A'},1),initial.id),
    service.save('articles',command({...articleData(),title:'Edição B'},1),initial.id),
  ]);
  assert.equal(results.filter(r=>r.status === 'fulfilled').length,1);
  assert.equal(results.filter(r=>r.status === 'rejected').length,1);
  assert.equal((await service.store.get('articles',initial.id))?.version,2);
});

test('URL é importada como incompleta; replay não refaz fetch; recaptura fixa nova revisão', async () => {
  let fetches = 0;
  const capture = async (url: string) => { fetches++; return { url, captured_at: new Date().toISOString(), title:'Artigo capturado',source_author:'Tara',
    content:`Conteúdo capturado de ensaio com argumento ${fetches}.`, images:[] }; };
  const input = {command_id:randomUUID(),url:'https://example.com/article'};
  const initial = await service.importUrl(input,capture);
  await service.importUrl(input,capture);
  assert.equal(fetches,1); assert.equal(initial.complete,false);
  const refreshed = await service.importUrl({command_id:randomUUID(),expected_version:1},capture,initial.id);
  assert.equal(refreshed.version,2);
  assert.notEqual(refreshed.content_hash,initial.content_hash);
  assert.equal((await service.store.get('articles',initial.id,1) as Article).content,initial.content);
});

test('Recaptura preserva associação só enquanto a autoria permanece igual e mantém revisões anteriores', async () => {
  const character = await createCharacter();
  let sourceAuthor = 'Tara';
  const capture = async (url: string) => ({ url, captured_at: new Date().toISOString(),
    title: 'Artigo com autoria revisável', source_author: sourceAuthor,
    content: 'Texto completo do artigo de ensaio para verificar associação e histórico.', images: [] });
  const initial = await service.importUrl({command_id:randomUUID(),url:'https://example.com/author'},capture);
  const associated = ArticleSchema.parse(await service.save('articles',command({title:initial.title,
    source_author:initial.source_author,content:initial.content,complete:true,
    character:{id:character.id,version:character.version}},1),initial.id));
  const unchanged = await service.importUrl({command_id:randomUUID(),expected_version:2},capture,initial.id);
  assert.deepEqual(unchanged.character,associated.character);
  sourceAuthor = 'Outra autora';
  const changed = await service.importUrl({command_id:randomUUID(),expected_version:3},capture,initial.id);
  assert.equal(changed.character,null);
  assert.equal(changed.complete,false);
  assert.deepEqual((await service.store.get('articles',initial.id,2) as Article).character,associated.character);
  assert.equal((await service.store.get('articles',initial.id,2) as Article).source_author,'Tara');
});

test('API integrada publica listas, versões, erros e filtra origem; saída valida contracts', async () => {
  const app = buildApp(service);
  try {
    const character = await createCharacter();
    const searchTitle = `BuscaExclusivaS1_${randomUUID()}`;
    const saved = await app.inject({method:'POST',url:'/api/articles',payload:command({...articleData(character),title:searchTitle})});
    assert.equal(saved.statusCode,201); const article = ArticleSchema.parse(saved.json());
    const list = await app.inject({method:'GET',url:`/api/articles?q=${searchTitle}&limit=1`});
    assert.equal(list.json().total,1); assert.equal(list.json().items[0].eligibility.allowed,true);
    assert.equal((await app.inject({method:'GET',url:`/api/articles/${article.id}?version=1`})).json().version,1);
    assert.equal((await app.inject({method:'GET',url:'/api/articles?limit=500'})).statusCode,400);
    assert.equal((await app.inject({method:'POST',url:'/api/articles',headers:{'content-type':'application/json'},payload:'{"broken":'})).statusCode,400);
    assert.equal((await app.inject({method:'GET',url:'/api/articles/missing'})).statusCode,404);
    assert.equal((await app.inject({method:'POST',url:`/api/articles/${article.id}/revisions`,payload:command(articleData(character),9)})).statusCode,409);
    assert.equal((await app.inject({method:'GET',url:'/api/universe'})).statusCode,200);
    assert.equal((await app.inject({method:'GET',url:'/api/profiles'})).statusCode,200);
    const bible = await app.inject({method:'GET',url:character.bible.original_uri});
    assert.equal(bible.body,characterData().bible_original); assert.match(bible.headers['content-type']!,/text\/plain/);
    assert.equal((await app.inject({method:'POST',url:'/api/articles',headers:{origin:'https://evil.example'},payload:command(articleData())})).statusCode,403);
    assert.equal((await app.inject({method:'GET',url:'/api/articles',headers:{host:'evil.example'}})).statusCode,403);
  } finally { await app.close(); }
});

const html = '<html><head><title>Artigo real de ensaio</title><meta name="author" content="Tara"></head><body><nav>Menu</nav><article><h1>Artigo real de ensaio</h1><p>Texto com argumentos suficientes para a captura revisável do artigo.</p><script>segredo()</script><img src="/photo.png"></article></body></html>';
test('Captura HTML limpa conteúdo, registra imagens sem aprová-las e não executa scripts', () => {
  const result = extractArticle(html,'https://example.com/article');
  assert.equal(result.source_author,'Tara'); assert(!result.content.includes('Menu')); assert(!result.content.includes('segredo'));
  assert.equal(result.images[0]?.usage_permission,'unknown'); assert.equal(result.images[0]?.uri,'https://example.com/photo.png');
});

test('Captura de listas e citações aninhadas preserva texto e ordem sem duplicar argumentos', () => {
  const nested = '<article><h1>Fonte com blocos aninhados</h1>'
    + '<blockquote>Introdução da citação.<p>Argumento citado uma única vez na fonte.</p>Atribuição da citação.</blockquote>'
    + '<ul><li>Primeira recomendação.<p>Detalhe da primeira recomendação.</p>'
    + '<ul><li>Item subordinado da recomendação.</li></ul></li><li>Segunda recomendação.</li></ul>'
    + '<p>Conclusão com <strong>ênfase</strong> editorial.</p></article>';
  const result = extractArticle(nested,'https://example.com/nested');
  assert.equal(result.content, ['Fonte com blocos aninhados', 'Introdução da citação.',
    'Argumento citado uma única vez na fonte.', 'Atribuição da citação.', 'Primeira recomendação.',
    'Detalhe da primeira recomendação.', 'Item subordinado da recomendação.', 'Segunda recomendação.',
    'Conclusão com ênfase editorial.'].join('\n\n'));
});

test('SSRF bloqueia IPs privados/reservados, URLs alternativas e normalização de IPs', () => {
  for (const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','100.64.0.1','0.0.0.0','::1','fc00::1','::ffff:8.8.8.8','2001:db8::1']) assert.equal(isPublicAddress(ip),false,ip);
  for (const url of ['file:///etc/passwd','http://localhost/x','http://2130706433/x','http://0x7f000001/x','http://[::1]/','https://user:pass@example.com','http://example.com:9000/x']) assert.throws(()=>validateCaptureUrl(url));
  assert.equal(isPublicAddress('8.8.8.8'),true);
});

test('SSRF valida todas as respostas DNS e cada redirect; download recebe IP fixado', async () => {
  let downloads = 0;
  const good: CaptureDependencies = {
    resolve: async()=>[{address:'8.8.8.8',family:4}],
    download: async (_url,address)=>{ downloads++; assert.equal(address.address,'8.8.8.8'); return {status:200,headers:{'content-type':'text/html'},body:html}; },
  };
  await captureArticle('https://example.com',good); assert.equal(downloads,1);
  await assert.rejects(captureArticle('https://example.com',{...good,resolve:async()=>[{address:'8.8.8.8',family:4},{address:'10.0.0.2',family:4}]}));
  assert.equal(downloads,1);
  await assert.rejects(captureArticle('https://example.com',{...good,download:async()=>({status:302,headers:{location:'http://169.254.169.254/latest'},body:''})}));
  await assert.rejects(captureArticle('https://example.com',{...good,download:async()=>({status:302,headers:{location:'http://example.com/plain'},body:''})}));
  await assert.rejects(captureArticle('https://example.com',{...good,download:async()=>({status:302,headers:{location:'/loop'},body:''})}));
});

test('Captura rejeita resposta não HTML, corpo excessivo e conteúdo vazio', async () => {
  const resolve: CaptureDependencies['resolve'] = async()=>[{address:'8.8.8.8',family:4}];
  for (const response of [
    {status:200,headers:{'content-type':'application/json'},body:'{}'},
    {status:200,headers:{'content-type':'text/html'},body:'x'.repeat(2_000_001)},
    {status:200,headers:{'content-type':'text/html'},body:'<html><body></body></html>'},
  ]) await assert.rejects(captureArticle('https://example.com',{resolve,download:async()=>response}));
});
