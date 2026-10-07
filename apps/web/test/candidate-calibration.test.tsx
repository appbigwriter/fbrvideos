import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {audioFixture,imageFixture,productionFixture} from '@fbr/contracts/fixtures';
import {CandidateCard,CandidateItemSchema,candidateEvaluation} from '../src/components/productions/CandidateMediaPanel.js';
import {calibrationObservation} from '../src/components/operations/CalibrationPanel.js';
test('Avaliação candidata exige revisão completa, direitos e mantém revisão/hash exatos',()=>{
 const production={id:productionFixture.id,version:productionFixture.version};
 assert.throws(()=>candidateEvaluation(production,audioFixture,'approved',false,true,'Conferido'),/inteiro/);
 assert.throws(()=>candidateEvaluation(production,audioFixture,'approved',true,false,'Conferido'),/direitos/);
 assert.throws(()=>candidateEvaluation(production,audioFixture,'rejected',true,false,'  '),/motivo/);
 const rejected=candidateEvaluation(production,audioFixture,'rejected',true,false,'Ruído na fala');assert.equal(rejected.rights_confirmed,false);assert.equal(rejected.hash,audioFixture.file.hash);assert.deepEqual(rejected.asset,{id:audioFixture.id,version:audioFixture.version});
 assert.throws(()=>CandidateItemSchema.parse({...audioFixture,preview_url:'https://external.example/media.mp3'}));
});
test('Preview mantém controles de áudio/vídeo, imagens acessíveis e declarações inicialmente desmarcadas',()=>{
 const production={id:productionFixture.id,version:productionFixture.version},onSaved=()=>{};
 const audio=CandidateItemSchema.parse({...audioFixture,status:'candidate',preview_url:'/api/productions/test/candidates/audio'});
 const html=renderToStaticMarkup(<CandidateCard asset={audio} production={production} onSaved={onSaved}/>);
 assert.match(html,/<audio[^>]*controls/);assert.doesNotMatch(html,/checked=""/);assert.match(html,/<button[^>]*disabled[^>]*>Aprovar arquivo/);
 const image=renderToStaticMarkup(<CandidateCard asset={CandidateItemSchema.parse({...imageFixture,status:'candidate',preview_url:'/api/productions/test/candidates/image'})} production={production} onSaved={onSaved}/>);assert.match(image,/alt="Imagem candidata/);
 const clip=renderToStaticMarkup(<CandidateCard asset={CandidateItemSchema.parse({...audio,type:'clip',preview_url:'/api/productions/test/candidates/clip'})} production={production} onSaved={onSaved}/>);assert.match(clip,/<video[^>]*controls/);
});
test('Observação de calibração conserva desconhecidos e exige contagens/evidência explícitas',()=>{
 const fields={id:'observation_test',version:'1',article_class:'explicação',format:'1080x1920@30',corrections:'0',fallbacks:'0',cost:'',minutes:'',reviewed:false,approved:false,reviewer:'Operador',evidence:'Teste local sintético'},at='2026-10-06T12:00:00Z';
 const record=calibrationObservation(productionFixture,fields,at);assert.equal(record.observation.confirmed_minor,null);assert.equal(record.observation.human_minutes,null);assert.equal(record.observation.human_reviewed,false);assert.equal(record.observation.approved,false);
 assert.throws(()=>calibrationObservation(productionFixture,{...fields,corrections:''},at),/inteiro/);
 assert.throws(()=>calibrationObservation(productionFixture,{...fields,approved:true},at),/revisão humana/);
 assert.throws(()=>calibrationObservation(productionFixture,{...fields,evidence:''},at),/evidências/);
 assert.equal(calibrationObservation(productionFixture,{...fields,cost:'0',minutes:'2.5'},at).observation.confirmed_minor,0);
});
