import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ArticleListSchema, ArticleFilterOptionsSchema, ArticleSchema, CharacterSchema, UniverseSchema, type Article, type ArticleFilters } from '@fbr/contracts';
import { ArticlesPanel } from '../components/articles/ArticlesPanel.js';
import { TextField, TextareaField, SelectField, CheckboxField } from '../components/forms/ConfigurationFields.js';
import { FormActions } from '../components/forms/FormActions.js';
import { useResource,useCommand } from '../api.js';
import { Page, ResourceState,field,parseRef,refValue } from './ConnectedShared.js';

export function ArticlesPage() {
  const navigate=useNavigate(); const [filters,setFilters]=useState<ArticleFilters>({q:'',source_author:'',character_id:'',status:''}),[offset,setOffset]=useState(0),[importing,setImporting]=useState(false);
  const query=new URLSearchParams({offset:String(offset),limit:'25'});for (const [key,value] of Object.entries(filters)) if(value)query.set(key,value);
  const articles=useResource(`/articles?${query}`,ArticleListSchema),universe=useResource('/universe',UniverseSchema);
  const authors=useResource('/articles/filter-options',ArticleFilterOptionsSchema);
  const empty={items:[],total:0,offset,limit:25};
  return <Page title="Artigos"><ArticlesPanel data={articles.data??empty} filters={filters} loading={articles.loading} error={articles.error}
    author_options={authors.data?.authors.map(value=>({value,label:value}))??[]}
    character_options={universe.data?.characters.map(c=>({value:c.id,label:c.name}))??[]}
    onFiltersChange={next=>{setFilters(next);setOffset(0);}} onImport={()=>setImporting(true)} onRetry={articles.reload} onPageChange={setOffset}
    onOpenArticle={ref=>navigate(`/artigos/${ref.id}?version=${ref.version}`)} onCreateVideo={ref=>navigate(`/producoes/nova?artigo=${ref.id}&version=${ref.version}`)}/>
    {importing && <ArticleEditor key="import" article={null} onCancel={()=>setImporting(false)} onSaved={article=>navigate(`/artigos/${article.id}?version=${article.version}`)}/>}</Page>;
}
export function ArticlePage() {
  const {id}=useParams(),[query]=useSearchParams();const navigate=useNavigate();
  const article=useResource(id?`/articles/${id}${query.has('version')?`?version=${encodeURIComponent(query.get('version')!)}`:''}`:null,ArticleSchema);
  const refresh=useCommand();
  return <Page title="Detalhe do artigo"><ResourceState {...article} onRetry={article.reload}/>{article.data && <>
    <p>Revisão v{article.data.version} · {article.data.source.kind==='url'?'Importado por URL':'Importado manualmente'}</p>
    <Link to={`/artigos/${id}`}>Abrir revisão atual</Link>
    {article.data.source.url && <><p><a href={article.data.source.url} target="_blank" rel="noreferrer">Fonte original</a></p><button disabled={refresh.pending} onClick={()=>void refresh.run(`/articles/${id}/refresh`,ArticleSchema,{expected_version:article.data!.version},a=>navigate(`/artigos/${a.id}?version=${a.version}`))}>Recapturar fonte</button>{refresh.error&&<p role="alert">{refresh.error}</p>}</>}
    <ArticleEditor key={`${article.data.id}:${article.data.version}`} article={article.data} onCancel={()=>navigate('/artigos')} onSaved={a=>{navigate(`/artigos/${a.id}?version=${a.version}`);article.reload();}}/>
    <Link className="action-link" to={`/producoes/nova?artigo=${id}&version=${article.data.version}`}>Criar produção com esta revisão</Link>
  </>}</Page>;
}
function ArticleEditor({article,onSaved,onCancel}:{article:Article|null;onSaved:(article:Article)=>void;onCancel:()=>void}) {
  const universe=useResource('/universe',UniverseSchema),command=useCommand();
  const pinned=useResource(article?.character?`/characters/${article.character.id}?version=${article.character.version}`:null,CharacterSchema);
  const characters=[...(universe.data?.characters??[])];
  if(pinned.data&&!characters.some(c=>refValue(c)===refValue(pinned.data!)))characters.push(pinned.data);
  const [mode,setMode]=useState('manual'),[url,setUrl]=useState(''),[title,setTitle]=useState(article?.title??''),[author,setAuthor]=useState(article?.source_author??''),
    [content,setContent]=useState(article?.content??''),[complete,setComplete]=useState(article?.complete??false),[character,setCharacter]=useState(refValue(article?.character??null));
  return <form className="connected-form" onSubmit={event=>{event.preventDefault();void command.run(mode==='url'?'/articles/import-url':article?`/articles/${article.id}/revisions`:'/articles',ArticleSchema,
    mode==='url'?{url}:{expected_version:article?.version??null,reason:article?'Revisão humana do conteúdo e autoria.':'Importação manual revisável.',data:{title,source_author:author,content,complete,character:parseRef(character)}},onSaved);}}>
    <h2>{article?'Revisar conteúdo e autoria':'Importar artigo'}</h2>
    <ResourceState {...universe} onRetry={universe.reload}/><ResourceState {...pinned} onRetry={pinned.reload}/>
    {!article&&<SelectField {...field('import-mode','Origem',command.pending)} value={mode} onChange={setMode} placeholder="Selecionar" options={[{value:'manual',label:'Colar texto'},{value:'url',label:'Capturar URL'}]}/>}
    {mode==='url'?<TextField {...field('article-url','URL pública',command.pending,'A captura será salva como incompleta para revisão humana.')} value={url} onChange={setUrl}/>:<>
      <TextField {...field('article-title','Título',command.pending)} required value={title} onChange={setTitle}/>
      <TextField {...field('article-author','Autora da fonte',command.pending)} required value={author} onChange={setAuthor}/>
      <TextareaField {...field('article-content','Texto integral',command.pending)} required value={content} onChange={setContent}/>
      <SelectField {...field('article-character','Personagem associada',command.pending)} value={character} onChange={setCharacter} placeholder="Autoria ainda não associada" options={characters.filter(c=>c.status==='confirmed').map(c=>({value:refValue(c),label:`${c.name} · v${c.version}`}))}/>
      <CheckboxField {...field('article-complete','Revisei e confirmei que a captura está completa',command.pending)} checked={complete} onChange={setComplete}/>
    </>}{command.error&&<p role="alert">{command.error}</p>}
    <FormActions pending={command.pending} can_submit={mode==='url'?!!url.trim():!!(title.trim()&&author.trim()&&content.trim())} submit_label={article?'Salvar nova revisão':'Importar artigo'} blocked_reason={null} onCancel={onCancel}/>
  </form>;
}
