import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {audioFixture,imageFixture,productionFixture} from '@fbr/contracts/fixtures';
import {CandidateCard,CandidateItemSchema,candidateEvaluation,candidateRetry} from '../src/components/productions/CandidateMediaPanel.js';
import {BudgetRevisionPanel,budgetRevision,decimalToMinor,minorLabel} from '../src/components/productions/BudgetRevisionPanel.js';
import {calibrationObservation} from '../src/components/operations/CalibrationPanel.js';
test('Avaliação candidata exige revisão completa, direitos e mantém revisão/hash exatos',()=>{
 const production={id:productionFixture.id,version:productionFixture.version};
 assert.throws(()=>candidateEvaluation(production,audioFixture,'approved',false,true,'Conferido'),/inteiro/);
 assert.throws(()=>candidateEvaluation(production,audioFixture,'approved',true,false,'Conferido'),/direitos/);
 assert.throws(()=>candidateEvaluation(production,audioFixture,'rejected',true,false,'  '),/motivo/);
 const rejected=candidateEvaluation(production,audioFixture,'rejected',true,false,'Ruído na fala');assert.equal(rejected.rights_confirmed,false);assert.equal(rejected.hash,audioFixture.file.hash);assert.deepEqual(rejected.asset,{id:audioFixture.id,version:audioFixture.version});
 assert.throws(()=>CandidateItemSchema.parse({...audioFixture,preview_url:'https://external.example/media.mp3'}));
});
test('Retry exige arquivo rejeitado e motivo; botão não inicia tentativa automaticamente',()=>{
 const production={id:productionFixture.id,version:productionFixture.version},rejected={...audioFixture,status:'rejected' as const};
 assert.throws(()=>candidateRetry(production,audioFixture,'Melhorar dicção'),/rejeitado/);
 assert.throws(()=>candidateRetry(production,rejected,''),/corrigido/);
 assert.deepEqual(candidateRetry(production,rejected,' Remover ruído '),{production,asset:{id:rejected.id,version:rejected.version},reason:'Remover ruído'});
 const html=renderToStaticMarkup(<CandidateCard asset={CandidateItemSchema.parse({...rejected,preview_url:'/api/productions/test/candidates/audio'})} production={production} onSaved={()=>{}}/>);
 assert.match(html,/<button[^>]*disabled[^>]*>Solicitar nova tentativa/);assert.match(html,/orçamento disponível/);
});
test('Revisão de orçamento usa unidade mínima exata, exige evidência e revisão desmarcada',()=>{
 assert.equal(decimalToMinor('120,05','BRL'),12005);assert.equal(decimalToMinor('0.29','USD'),29);assert.equal(decimalToMinor('123','JPY'),123);assert.equal(decimalToMinor('1.234','KWD'),1234);
 for(const value of ['1.000,00','-1','1e4','1,005','90071992547409.92','NaN'])assert.throws(()=>decimalToMinor(value,'BRL'));
 assert.equal(minorLabel(12005,'BRL'),'BRL 120,05');
 const fields={ceiling:'150,00',reason:'Limite autorizado',source:'Operador responsável',evidence:'Registro de autorização do ensaio',reviewed:true};
 const body=budgetRevision(productionFixture,fields);assert.equal(body.ceiling_minor,15000);assert.equal(body.currency,'BRL');assert.deepEqual(body.production,{id:productionFixture.id,version:productionFixture.version});
 assert.throws(()=>budgetRevision(productionFixture,{...fields,reviewed:false}),/Confira/);assert.throws(()=>budgetRevision(productionFixture,{...fields,evidence:''}),/evidência/);assert.throws(()=>budgetRevision(productionFixture,{...fields,ceiling:'100,00'}),/aumento explícito/);
 const html=renderToStaticMarkup(<BudgetRevisionPanel production={productionFixture} onSaved={()=>{}}/>);assert.doesNotMatch(html,/checked=""/);assert.match(html,/<button[^>]*disabled[^>]*>Registrar novo limite/);
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
