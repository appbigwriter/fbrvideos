import { useState } from 'react';
import { ProfileSchema, ProfilesSchema, UniverseSchema, PipelineCatalogSchema, configurationStatusLabels,
  type Profile, type Universe, type PipelineCatalog } from '@fbr/contracts';
import { TextField,NumberField,SelectField,CheckboxField } from '../components/forms/ConfigurationFields.js';
import { FormActions } from '../components/forms/FormActions.js';
import { useResource,useCommand } from '../api.js';
import { Page,ResourceState,field,refValue,parseRef } from './ConnectedShared.js';

export function ProfilesPage() {
  const profiles=useResource('/profiles',ProfilesSchema),universe=useResource('/universe',UniverseSchema),catalog=useResource('/pipeline/catalog',PipelineCatalogSchema);
  const [editing,setEditing]=useState(false),[selected,setSelected]=useState<Profile|null>(null);
  return <Page title="Perfis de produção"><button onClick={()=>{setSelected(null);setEditing(true);}}>Novo perfil</button>
    <ResourceState {...profiles} onRetry={profiles.reload}/><ResourceState {...universe} onRetry={universe.reload}/><ResourceState {...catalog} onRetry={catalog.reload}/>
    {profiles.data?.items.length===0&&<p>Nenhum perfil cadastrado.</p>}
    <div className="connected-cards">{profiles.data?.items.map(profile=><article key={profile.id}><h2>{profile.name}</h2><p>v{profile.version} · {configurationStatusLabels[profile.status]}</p>
      <p>{catalog.data?.recipes.find(r=>r.id===profile.recipe)?.label??profile.recipe??'Receita ainda não definida'}</p><button onClick={()=>{setSelected(profile);setEditing(true);}}>Editar perfil</button></article>)}</div>
    {editing&&universe.data&&catalog.data&&<ProfileEditor key={selected?refValue(selected):'new'} profile={selected} universe={universe.data} catalog={catalog.data}
      onCancel={()=>setEditing(false)} onSaved={()=>{setEditing(false);profiles.reload();}}/>}</Page>;
}
const numeric = (value:string) => value.trim()?Number(value):null;
const money = (value:string) => {
  const normalized=value.trim().replace(',','.');if(!normalized)return null;
  if(!/^\d+(?:\.\d{1,2})?$/.test(normalized))return NaN;
  const [whole,fraction='']=normalized.split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));
};
function ProfileEditor({profile,universe,catalog,onCancel,onSaved}:{profile:Profile|null;universe:Universe;catalog:PipelineCatalog;onCancel:()=>void;onSaved:()=>void}) {
  const pinned=useResource(profile?`/profiles/${profile.id}/universe?version=${profile.version}`:null,UniverseSchema);
  const choices=pinned.data??universe;
  const command=useCommand();const [name,setName]=useState(profile?.name??''),[status,setStatus]=useState(profile?.status??'draft'),[character,setCharacter]=useState(refValue(profile?.character??null)),
    [language,setLanguage]=useState(profile?.language??'pt-BR'),[duration,setDuration]=useState(String(profile?.target_seconds??'')),[recipe,setRecipe]=useState(profile?.recipe??''),
    [voice,setVoice]=useState(refValue(profile?.voice??null)),[classes,setClasses]=useState(profile?.permitted_shot_classes??[]),[references,setReferences]=useState(profile?.permitted_references??[]),
    [width,setWidth]=useState(String(profile?.delivery?.width??'')),[height,setHeight]=useState(String(profile?.delivery?.height??'')),[fps,setFps]=useState(String(profile?.delivery?.fps??'')),
    [currency,setCurrency]=useState(profile?.budget?.currency??'BRL'),[ceiling,setCeiling]=useState(profile?.budget?String(profile.budget.ceiling_minor/100):''),
    [margin,setMargin]=useState(profile?.budget?String(profile.budget.safety_margin_minor/100):''),[attempts,setAttempts]=useState(String(profile?.budget?.max_attempts_per_job??''));
  const [formError,setFormError]=useState<string|null>(null);
  return <form className="connected-form" onSubmit={event=>{
    event.preventDefault();setFormError(null);
    const deliveryFilled=[width,height,fps].some(v=>v.trim()),budgetFilled=[ceiling,margin,attempts].some(v=>v.trim());
    if(deliveryFilled&&![width,height,fps].every(v=>v.trim()&&Number(v)>0)){setFormError('Preencha largura, altura e fps positivos ou deixe o formato vazio.');return;}
    if(budgetFilled&&![ceiling,margin,attempts].every(v=>v.trim())){setFormError('Preencha teto, margem e tentativas ou deixe o orçamento vazio.');return;}
    if(budgetFilled&&(!Number.isSafeInteger(money(ceiling))||!Number.isSafeInteger(money(margin)))){setFormError('Use valores monetários positivos ou zero, com até duas casas decimais.');return;}
    const chosen=parseRef(character);if(!chosen){setFormError('Selecione uma versão confirmada de personagem.');return;}
    void command.run(profile?`/profiles/${profile.id}/revisions`:'/profiles',ProfileSchema,{expected_version:profile?.version??null,reason:'Configuração do perfil de produção.',data:{
      name,status,character:chosen,language,target_seconds:numeric(duration),recipe:recipe||null,voice:parseRef(voice),permitted_shot_classes:classes,permitted_references:references,
      delivery:deliveryFilled?{width:Number(width),height:Number(height),fps:Number(fps),video_codec:profile?.delivery?.video_codec??'h264',audio_codec:profile?.delivery?.audio_codec??'aac',audio_sample_rate:profile?.delivery?.audio_sample_rate??48000,subtitle_format:profile?.delivery?.subtitle_format??'srt'}:null,
      budget:budgetFilled?{currency,ceiling_minor:money(ceiling),safety_margin_minor:money(margin),max_attempts_per_job:Number(attempts)}:null,calibration_scope:profile?.calibration_scope??null}},onSaved);
  }}><h2>{profile?'Revisar perfil':'Novo perfil'}</h2><p>Receitas e formatos são candidatos. Salvar não valida o perfil nem inicia geração.</p>
    <TextField {...field('profile-name','Nome',command.pending)} required value={name} onChange={setName}/>
    <SelectField {...field('profile-status','Situação',command.pending)} value={status} onChange={v=>setStatus(v as Profile['status'])} placeholder="Selecionar" options={[{value:'draft',label:'Rascunho'},{value:'calibrating',label:'Em calibração'},{value:'suspended',label:'Suspenso'}]}/>
    <ResourceState {...pinned} onRetry={pinned.reload}/>
    <SelectField {...field('profile-character','Personagem',command.pending)} required value={character} onChange={setCharacter} placeholder="Selecionar versão confirmada" options={choices.characters.filter(c=>c.status==='confirmed').map(c=>({value:refValue(c),label:`${c.name} · v${c.version}`}))}/>
    <TextField {...field('profile-language','Idioma',command.pending)} required value={language} onChange={setLanguage}/>
    <NumberField {...field('profile-duration','Duração-alvo em segundos',command.pending)} value={duration} onChange={setDuration}/>
    <SelectField {...field('profile-recipe','Receita candidata',command.pending)} value={recipe} onChange={setRecipe} placeholder="Ainda não definida" options={catalog.recipes.map(r=>({value:r.id,label:`${r.label}${r.state==='experimental'?' · experimental':''}`}))}/>
    <SelectField {...field('profile-voice','Voz',command.pending,'Cadastre uma referência vocal no Universo; acesso e qualidade ainda dependem de ensaio.')} value={voice} onChange={setVoice} placeholder="Ainda não definida" options={choices.references.filter(r=>r.kind==='voice'&&r.status!=='archived').map(r=>({value:refValue(r),label:`${r.name} · v${r.version}`}))}/>
    <fieldset><legend>Classes de plano permitidas</legend>{catalog.shot_classes.map(cls=><CheckboxField key={cls.id} {...field(`shot-${cls.id}`,cls.label,command.pending)} checked={classes.includes(cls.id)} onChange={checked=>setClasses(previous=>checked?[...previous,cls.id]:previous.filter(v=>v!==cls.id))}/>)}</fieldset>
    <fieldset><legend>Referências permitidas</legend>{choices.references.filter(r=>r.status!=='archived').map(ref=><CheckboxField key={refValue(ref)} {...field(`ref-${ref.id}-${ref.version}`,`${ref.name} · v${ref.version}`,command.pending)} checked={references.some(r=>refValue(r)===refValue(ref))} onChange={checked=>setReferences(previous=>checked?[...previous,{id:ref.id,version:ref.version}]:previous.filter(r=>refValue(r)!==refValue(ref)))}/>)}</fieldset>
    <fieldset><legend>Formato candidato</legend><div className="connected-columns">
      <NumberField {...field('profile-width','Largura em pixels',command.pending)} value={width} onChange={setWidth}/><NumberField {...field('profile-height','Altura em pixels',command.pending)} value={height} onChange={setHeight}/><NumberField {...field('profile-fps','Quadros por segundo',command.pending)} value={fps} onChange={setFps}/>
    </div><p>Vídeo H.264, áudio AAC e legendas SRT para novos perfis; formato sujeito à calibração.</p></fieldset>
    <fieldset><legend>Limites do ensaio</legend><TextField {...field('profile-currency','Moeda',command.pending,'Código de três letras, por exemplo BRL.')} value={currency} onChange={setCurrency}/>
      <TextField {...field('profile-ceiling',`Teto em ${currency}`,command.pending,'Valor na moeda indicada, por exemplo 50,00.')} value={ceiling} onChange={setCeiling}/>
      <TextField {...field('profile-margin',`Margem de segurança em ${currency}`,command.pending)} value={margin} onChange={setMargin}/>
      <NumberField {...field('profile-attempts','Máximo de tentativas por job',command.pending)} value={attempts} onChange={setAttempts}/></fieldset>
    {(formError||command.error)&&<p role="alert">{formError??command.error}</p>}
    <FormActions pending={command.pending} can_submit={!!(name.trim()&&character&&language.trim())&&status!=='validated'&&!pinned.loading&&!pinned.error} submit_label="Salvar perfil" blocked_reason={status==='validated'?'Validação exige evidência e workflow de calibração.':pinned.error} onCancel={onCancel}/>
  </form>;
}
