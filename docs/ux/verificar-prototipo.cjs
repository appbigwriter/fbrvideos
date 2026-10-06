// Verificação da demonstração local, sem browser, fornecedor ou regras do backend.
// DOM mínimo verifica lógica e HTML emitido; não comprova layout/acessibilidade visual.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, 'prototipo-jornada.html'), 'utf8');
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/cenarios-v0.1.json'), 'utf8'));
const fixtureText = html.match(/<script id="fixture" type="application\/json">([\s\S]*?)<\/script>/)[1];
assert.deepEqual(JSON.parse(fixtureText), fixtures, 'Fixture externa e embutida devem coincidir');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
new vm.Script(script); // Sintaxe do script executável, sem confundir JSON com JS.
const nodes = new Map();
const actions = new Map();
const listeners = {};
let downloaded = null;
class Element {
  constructor(id = '') { this.id = id; this.events = {}; this.value = ''; this.checked = false; this.disabled = false; this._html = ''; }
  addEventListener(event, fn) { this.events[event] = fn; }
  focus() {}
  click() { if (this.download) downloaded = { name: this.download, href: this.href }; else this.events.click?.(); }
  set innerHTML(value) {
    this._html = value;
    if (this.id !== 'content') return;
    actions.clear();
    for (const id of ['sourceText', 'reviewed', 'category', 'comment']) nodes.delete(id);
    for (const match of value.matchAll(/<button\s([^>]+)>/g)) {
      const action = match[1].match(/data-action="([^"]+)"/);
      if (action) { const el = new Element(); el.dataset = { action: action[1] }; el.disabled = /\bdisabled\b/.test(match[1]); actions.set(action[1], el); }
    }
    for (const match of value.matchAll(/<(input|textarea|select)\b[^>]*id="([^"]+)"[^>]*>/g)) {
      const el = new Element(match[2]);
      if (match[1] === 'textarea') el.value = value.slice(match.index + match[0].length).split('</textarea>')[0];
      if (match[1] === 'select') el.value = value.slice(match.index + match[0].length).match(/<option>([^<]+)<\/option>/)?.[1] || '';
      nodes.set(match[2], el);
    }
  }
  get innerHTML() { return this._html; }
}
for (const id of ['fixture', 'scenario', 'reset', 'notice', 'nav', 'content']) nodes.set(id, new Element(id));
nodes.get('fixture').textContent = fixtureText;
let hash = '';
const location = { get hash() { return hash; }, set hash(v) { hash = '#' + String(v).replace(/^#/, ''); listeners.hashchange?.(); } };
const document = {
  getElementById: id => nodes.get(id) || null,
  querySelectorAll: () => [...actions.values()],
  querySelector: selector => actions.get(selector.match(/data-action="([^"]+)"/)[1]),
  createElement: () => new Element(),
};
const context = vm.createContext({ document, location, window: { addEventListener: (event, fn) => listeners[event] = fn }, Intl, Blob,
  URL: { createObjectURL: () => 'blob:fixture-only', revokeObjectURL: () => {} }, setTimeout: fn => fn() });
vm.runInContext(script, context);
const run = code => vm.runInContext(code, context);
const output = () => nodes.get('content').innerHTML;
const state = key => run(`S.${key}`);
const act = id => run(`act('${id}')`);
const go = route => run(`go('${route}')`);
const reset = id => run(`reset('${id}')`);
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`OK ${name}`); }

check('menu e todas as telas navegam sem executar serviço', () => {
  for (const route of ['inicio','artigos','artigo','criar','producoes','producao','revisao','correcao','entrega','perfis','universo','configuracoes']) {
    go(route); assert.match(output(), /<h1>/);
  }
  assert.match(nodes.get('nav').innerHTML, /Perfis de produção/);
});
check('fonte incompleta bloqueia geração; correção fixa nova revisão', () => {
  reset('origem-incompleta'); go('criar'); assert.equal(actions.get('generate').disabled, true);
  act('generate'); assert.equal(state('created'), false);
  go('artigo'); nodes.get('sourceText').value = ''; act('save-source'); assert.equal(state('incomplete'), true);
  nodes.get('sourceText').value = fixtures.article.text; act('save-source'); assert.equal(state('articleVersion'), 2);
  go('criar'); assert.equal(actions.get('generate').disabled, false); act('generate'); assert.equal(state('productionArticleVersion'), 2);
  run('S.articleVersion=3'); go('producao'); assert.match(output(), /revisão 2/);
});
check('pausa/retomada preservam produção e sinalizam jobs externos', () => {
  reset('sucesso'); go('criar'); act('generate'); act('pause'); assert.equal(state('state'), 'paused');
  assert.match(output(), /Trabalhos já enviados podem continuar/); act('resume'); assert.equal(state('state'), 'producing');
});
check('entrega bloqueada até declaração integral e aprovação da versão', () => {
  act('ready'); go('entrega'); assert.match(output(), /Exportação aprovada indisponível/);
  go('revisao'); assert.equal(actions.get('approve').disabled, true);
  act('approve'); assert.equal(state('approvalVersion'), null);
  nodes.get('reviewed').checked = true; nodes.get('reviewed').events.change(); assert.equal(actions.get('approve').disabled, false);
  act('approve'); assert.equal(state('approvalVersion'), 1); assert.equal(location.hash, '#entrega');
  assert.equal(actions.get('media').disabled, true); act('download'); assert.equal(downloaded.name, 'fbr-videos-recibo-ficticio-ux.txt');
  assert.equal(state('state'), 'exported');
});
check('correção visual invalida aprovação ativa, preserva histórico e exige nova revisão', () => {
  go('correcao'); nodes.get('comment').value = '<img src=x onerror=alert(1)>'; act('propose');
  assert.match(output(), /&lt;img/); assert.match(output(), /roteiro, áudio e legendas válidos/);
  act('execute'); assert.equal(state('approvalVersion'), null); assert.equal(state('state'), 'correcting');
  act('finish-correction'); assert.equal(state('renderVersion'), 2); assert.equal(state('state'), 'ready_for_review');
  assert.match(output(), /aprovação simulada preservada no histórico/);
  go('entrega'); assert.match(output(), /Exportação aprovada indisponível/); go('revisao'); assert.equal(actions.get('approve').disabled, true);
});
check('mudança de fala explicita fidelidade e dependências', () => {
  reset('correcao'); go('correcao'); nodes.get('category').value = 'Problema na fala/voz'; nodes.get('comment').value = 'Nova fala de exemplo'; act('propose');
  assert.match(output(), /áudio, lip sync, legendas, tempos/); assert.match(output(), /fidelidade à fonte/);
});
check('falha conhecida oferece recuperação localizada', () => {
  reset('falha'); const original = JSON.stringify(state('costs')); assert.match(output(), /Falha conhecida/);
  act('retry'); assert.equal(state('state'), 'producing'); assert.equal(JSON.stringify(state('costs')), original);
});
check('limite esgotado bloqueia retomada e cancelamento preserva custo', () => {
  reset('limite'); const original = JSON.stringify(state('costs')); assert.equal(actions.get('resume').disabled, true);
  act('resume'); assert.equal(state('state'), 'awaiting_decision'); assert.equal(actions.has('ready'), false);
  go('criar'); assert.equal(actions.get('generate').disabled, true); act('generate'); assert.equal(state('state'), 'awaiting_decision');
  go('producao');
  act('cancel'); assert.equal(state('state'), 'cancelled'); assert.equal(JSON.stringify(state('costs')), original);
});
assert.ok(!/\bfetch\s*\(|https?:\/\//.test(script), 'Protótipo não deve fazer chamadas externas');
console.log(`${checks} cenários verificados; JSON embutido/externo e sintaxe também válidos. DOM mínimo não comprova render visual.`);
