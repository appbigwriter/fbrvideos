import { useState } from 'react';
import { UniverseSchema, CharacterSchema, ReferenceSchema, selectedUniverseRecord, type Character, type Reference, type UniverseTab, type UniverseSelection } from '@fbr/contracts';
import { UniversePanel } from '../components/universe/UniversePanel.js';
import { TextField,TextareaField,SelectField,CheckboxField } from '../components/forms/ConfigurationFields.js';
import { FormActions } from '../components/forms/FormActions.js';
import { api,useResource,useCommand } from '../api.js';
import { Page,ResourceState,field,refValue,parseRef } from './ConnectedShared.js';

export function UniversePage() {
  const resource=useResource('/universe',UniverseSchema),[tab,setTab]=useState<UniverseTab>('characters'),[selected,setSelected]=useState<UniverseSelection>(null);
  const [editing,setEditing]=useState<'character'|'reference'|null>(null),[record,setRecord]=useState<Character|Reference|null>(null),[bible,setBible]=useState<string|null>(null),[bibleError,setBibleError]=useState<string|null>(null);
  const data=resource.data??{characters:[],references:[]}; const picked=selectedUniverseRecord(data,selected);
  const openBible=async (ref:{id:string;version:number})=>{
    setBible(null);setBibleError(null);
    try {const character=await api(`/characters/${ref.id}?version=${ref.version}`,CharacterSchema);
      const response=await fetch(`/api/bibles/${character.bible.original_hash}`);if(!response.ok)throw new Error('Bible original indisponível.');setBible(await response.text());}
    catch(e){setBibleError(e instanceof Error?e.message:'Falha ao abrir Bible.');}
  };
  const saved=()=>{setEditing(null);setSelected(null);resource.reload();};
  return <Page title="Universo"><div className="connected-actions"><button onClick={()=>{setRecord(null);setEditing('character');}}>Nova personagem</button><button onClick={()=>{setRecord(null);setEditing('reference');}}>Nova referência</button>
    {picked&&<button onClick={()=>{setRecord(picked);setEditing(selected?.kind??null);}}>Editar seleção · nova revisão</button>}</div>
    <UniversePanel data={data} tab={tab} selected={selected} loading={resource.loading} error={resource.error} onRetry={resource.reload}
      onTabChange={value=>{setTab(value);setSelected(null);}} onSelect={setSelected} onOpenBible={ref=>void openBible(ref)}/>
    {bibleError&&<p role="alert">{bibleError}</p>}{bible!==null&&<section className="original-bible"><h2>Bible original</h2><pre>{bible}</pre><button onClick={()=>setBible(null)}>Fechar original</button></section>}
    {editing==='character'&&<CharacterEditor key={record?.id??'new-character'} record={record as Character|null} references={data.references} onCancel={()=>setEditing(null)} onSaved={saved}/>}
    {editing==='reference'&&<ReferenceEditor key={record?.id??'new-reference'} record={record as Reference|null} onCancel={()=>setEditing(null)} onSaved={saved}/>}</Page>;
}
function CharacterEditor({record,references,onCancel,onSaved}:{record:Character|null;references:Reference[];onCancel:()=>void;onSaved:()=>void}) {
  const pinned=useResource(record?.voice?`/references/${record.voice.id}?version=${record.voice.version}`:null,ReferenceSchema);
  const choices=[...references];if(pinned.data&&!choices.some(r=>refValue(r)===refValue(pinned.data!)))choices.push(pinned.data);
  const command=useCommand();const [name,setName]=useState(record?.name??''),[status,setStatus]=useState(record?.status??'draft'),[original,setOriginal]=useState(''),
    [interpretation,setInterpretation]=useState(record?.bible.interpretation??''),[confirmed,setConfirmed]=useState(record?.bible.interpretation_confirmed??false),
    [voice,setVoice]=useState(refValue(record?.voice??null)),[variations,setVariations]=useState(record?.authorized_variations.join('\n')??'');
  return <form className="connected-form" onSubmit={event=>{event.preventDefault();void command.run(record?`/characters/${record.id}/revisions`:'/characters',CharacterSchema,
    {expected_version:record?.version??null,reason:'Cadastro/revisão de personagem e interpretação do Bible.',data:{name,status,interpretation,interpretation_confirmed:confirmed,
      ...(original?{bible_original:original}:{}),references:record?.references??[],voice:parseRef(voice),authorized_variations:variations.split('\n').filter(v=>v.trim())}},onSaved);}}>
    <h2>{record?'Revisar personagem':'Nova personagem'}</h2>
    <ResourceState {...pinned} onRetry={pinned.reload}/>
    <TextField {...field('character-name','Nome',command.pending)} required value={name} onChange={setName}/>
    <SelectField {...field('character-status','Situação',command.pending)} value={status} onChange={v=>setStatus(v as Character['status'])} placeholder="Selecionar" options={[{value:'draft',label:'Rascunho'},{value:'confirmed',label:'Confirmado'},{value:'archived',label:'Arquivado'}]}/>
    <TextareaField {...field('character-original','Bible original',command.pending,record?'Deixe vazio para preservar o original desta revisão. Novo texto cria outro original preservando o anterior.':'Cole o documento original integralmente.')} required={!record} value={original} onChange={setOriginal}/>
    <TextareaField {...field('character-interpretation','Interpretação',command.pending,'Leitura editorial separada do documento original.')} required value={interpretation} onChange={setInterpretation}/>
    <CheckboxField {...field('character-confirmed','Revisei e confirmei a interpretação',command.pending)} checked={confirmed} onChange={setConfirmed}/>
    <SelectField {...field('character-voice','Voz oficial',command.pending,'Escolher uma referência vocal não valida sua qualidade ou integração.')} value={voice} onChange={setVoice} placeholder="Ainda não definida" options={choices.filter(r=>r.kind==='voice'&&r.status!=='archived').map(r=>({value:refValue(r),label:`${r.name} · v${r.version}`}))}/>
    <TextareaField {...field('character-variations','Variações autorizadas',command.pending,'Uma por linha.')} value={variations} onChange={setVariations}/>
    {command.error&&<p role="alert">{command.error}</p>}<FormActions pending={command.pending} can_submit={!!(name.trim()&&interpretation.trim()&&(record||original)&&(status!=='confirmed'||confirmed))} submit_label="Salvar personagem" blocked_reason={status==='confirmed'&&!confirmed?'Confirme a interpretação antes de confirmar a personagem.':null} onCancel={onCancel}/>
  </form>;
}
function ReferenceEditor({record,onCancel,onSaved}:{record:Reference|null;onCancel:()=>void;onSaved:()=>void}) {
  const command=useCommand();const [name,setName]=useState(record?.name??''),[kind,setKind]=useState(record?.kind??'environment'),[status,setStatus]=useState(record?.status??'pending'),
    [permission,setPermission]=useState(record?.usage_permission??'unknown'),[rules,setRules]=useState(record?.rules.join('\n')??'');
  return <form className="connected-form" onSubmit={event=>{event.preventDefault();void command.run(record?`/references/${record.id}/revisions`:'/references',ReferenceSchema,{expected_version:record?.version??null,reason:'Cadastro/revisão de referência.',
    data:{name,kind,status,usage_permission:permission,rules:rules.split('\n').filter(r=>r.trim()),asset_refs:record?.asset_refs??[]}},onSaved);}}>
    <h2>{record?'Revisar referência':'Nova referência'}</h2><p>Cadastro de metadados. Upload e aprovação de mídia serão disponibilizados posteriormente.</p>
    <TextField {...field('reference-name','Nome',command.pending)} required value={name} onChange={setName}/>
    <SelectField {...field('reference-kind','Tipo',command.pending)} value={kind} onChange={v=>setKind(v as Reference['kind'])} placeholder="Selecionar" options={Object.entries({character:'Personagem',environment:'Ambiente',wardrobe:'Figurino',prop:'Objeto',style:'Estilo',voice:'Voz',composition:'Composição'}).map(([value,label])=>({value,label}))}/>
    <SelectField {...field('reference-status','Situação',command.pending)} value={status} onChange={v=>setStatus(v as Reference['status'])} placeholder="Selecionar" options={[{value:'pending',label:'Pendente'},{value:'archived',label:'Arquivado'}]}/>
    <SelectField {...field('reference-permission','Direito de uso declarado',command.pending)} value={permission} onChange={v=>setPermission(v as Reference['usage_permission'])} placeholder="Selecionar" options={[{value:'unknown',label:'Desconhecido'},{value:'allowed',label:'Permitido'},{value:'denied',label:'Negado'}]}/>
    <TextareaField {...field('reference-rules','Regras e evidências de uso',command.pending,'Uma por linha; declaração não equivale à aprovação da mídia.')} value={rules} onChange={setRules}/>
    {command.error&&<p role="alert">{command.error}</p>}<FormActions pending={command.pending} can_submit={!!name.trim()&&status!=='approved'} submit_label="Salvar referência" blocked_reason={status==='approved'?'Escolha uma situação de cadastro; aprovação exige o workflow de mídia.':null} onCancel={onCancel}/>
  </form>;
}
