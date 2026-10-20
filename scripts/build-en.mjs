// Site em inglês: gera docs/app.en.js e docs/core.en.js a partir de docs/app.js e docs/core.js, trocando os textos
// (strings do código) pelas traduções de i18n/en.json. O código fica igual; só mudam os textos que se veem.
//
//   npm i --no-save acorn acorn-walk     (só para correr isto; o site não precisa)
//   node scripts/build-en.mjs            → gera os dois ficheiros; falha se faltar decidir algum texto
//   node scripts/build-en.mjs --missing  → escreve i18n/missing.json com os textos por traduzir (e o contexto)
//   node scripts/build-en.mjs --check    → falha se docs/app.en.js ou docs/core.en.js não estiverem em dia
//
// i18n/en.json: { "texto em português": "English text" | null (fica igual) | { "en": "...", "at": { "<linha>": true | false | "texto" | [uma por ocorrência] } } }
// A forma com "at" é para textos que no código servem de valor interno nalguns sítios e de texto noutros
// (p. ex. 'jogo' = estado do jogo e 'jogo' = palavra): decide-se linha a linha (true = traduz, false = fica).
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MAP_FILE = path.join(root, 'i18n', 'en.json');
const map = fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')) : {};

// métodos e funções cujos argumentos de texto são nomes internos (ids, chaves, tabelas, seletores…)
const SKIP_METHODS = new Set(['getItem', 'setItem', 'removeItem', 'from', 'select', 'eq', 'neq', 'in', 'order', 'gte', 'lte', 'gt', 'lt', 'is', 'not', 'match', 'contains', 'upsert', 'insert', 'update', 'delete', 'rpc', 'channel', 'on',
  'getElementById', 'querySelector', 'querySelectorAll', 'addEventListener', 'removeEventListener', 'getAttribute', 'removeAttribute', 'hasAttribute', 'toggle', 'add', 'remove', 'has', 'get', 'includes', 'indexOf', 'lastIndexOf',
  'startsWith', 'endsWith', 'split', 'closest', 'matches', 'createElement', 'getPropertyValue', 'setProperty', 'padStart', 'padEnd', 'test', 'exec', 'localeCompare', 'reload', 'assign', 'replaceState', 'pushState']);
const SKIP_CALLS = new Set(['$', 'fetch', 'require', 'createClient', 'fetchAll', 'setSub', 'subOf', 'setTab', 'subBar', 'planOf', 'usedCount', 'engineInputs', 'usesEff', 'setUsesOf', 'statShort', 'statLabel', 'typingField', 'Symbol', 'RegExp', 'Date', 'URL', 'Error']);
const SKIP_NEW = new Set(['Date', 'RegExp', 'URL', 'Intl', 'Event', 'CustomEvent', 'Map', 'Set', 'Function']);
const HUMAN_ATTR = /(?:title|aria-label|placeholder|alt)="([^"]*)/g;

function ctxLine(src, pos) {
  const a = src.lastIndexOf('\n', pos) + 1, b = src.indexOf('\n', pos);
  return src.slice(a, b < 0 ? undefined : b).replace(/\s+/g, ' ').trim().slice(0, 160);
}
// o que se vê de um pedaço de HTML: texto fora das etiquetas e dos atributos, mais title/aria-label/placeholder/alt
function visible(str) {
  const human = []; let m; HUMAN_ATTR.lastIndex = 0; while ((m = HUMAN_ATTR.exec(str))) human.push(m[1]);
  let t = str.replace(/<[^>]*>/g, ' ');
  t = t.replace(/^[^<>]*>/, x => (/="|^\s*"/.test(x) ? ' ' : x));
  t = t.replace(/<[^>]*$/, ' ');
  t = t.replace(/\s*[\w-]+="[^"]*"?/g, ' ');
  return (t + ' ' + human.join(' ')).trim();
}
const hasLetters = s => /[A-Za-zÀ-ÿ]/.test(s);

function skipByContext(node, ancestors) {
  const parent = ancestors[ancestors.length - 2], gp = ancestors[ancestors.length - 3];
  if (!parent) return false;
  if (parent.type === 'ExpressionStatement' && parent.directive) return true;
  if (/^(Import|Export)/.test(parent.type)) return true;
  if (parent.type === 'Property' && parent.key === node) return true;
  if (parent.type === 'MemberExpression' && parent.property === node) return true;
  if (parent.type === 'BinaryExpression' && ['===', '!==', '==', '!=', 'in', 'instanceof'].includes(parent.operator)) return true;
  if (parent.type === 'SwitchCase' && parent.test === node) return true;
  if (parent.type === 'SwitchStatement' && parent.cases.some(c => c.test === node)) return true; // o acorn-walk não passa pelo SwitchCase
  if (parent.type === 'NewExpression' && parent.callee.type === 'Identifier' && SKIP_NEW.has(parent.callee.name)) return true;
  if (parent.type === 'CallExpression' && parent.arguments.includes(node)) {
    const c = parent.callee;
    if (c.type === 'Identifier' && SKIP_CALLS.has(c.name)) return true;
    if (c.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier') {
      const n = c.property.name;
      if (SKIP_METHODS.has(n)) return true;
      if (n === 'setAttribute' && parent.arguments[0] === node) return true;
      if (n === 'replace' && parent.arguments[0] === node) return true;
      if ((n === 'getItem' || n === 'setItem') && c.object.type === 'Identifier' && c.object.name === 'localStorage') return true;
    }
  }
  // ['a', 'b'].includes(x) / .indexOf(x): listas de valores internos
  if (parent.type === 'ArrayExpression' && gp && gp.type === 'MemberExpression' && gp.object === parent && !gp.computed && gp.property.type === 'Identifier' && ['includes', 'indexOf'].includes(gp.property.name)) return true;
  return false;
}

function quote(str, q) {
  let out = '';
  for (const ch of str) {
    if (ch === '\\') out += '\\\\';
    else if (ch === q) out += '\\' + q;
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === ' ' || ch === ' ') out += '\\u' + ch.charCodeAt(0).toString(16);
    else out += ch;
  }
  return q + out + q;
}

function processFile(file, sourceType) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType, locations: false });
  const occ = [];
  walk.fullAncestor(ast, (node, state, ancestors) => {
    if (node.type === 'Literal' && typeof node.value === 'string') occ.push({ node, value: node.value, kind: 'lit', skip: skipByContext(node, ancestors) });
    else if (node.type === 'TemplateLiteral') {
      const parent = ancestors[ancestors.length - 2];
      const tagged = parent && parent.type === 'TaggedTemplateExpression';
      // os modelos com código Cadence (blockchain) ficam como estão
      const isCode = node.quasis.some(q => /import |access\(all\)|fun main|pub fun/.test(q.value.cooked || ''));
      node.quasis.forEach(q => occ.push({ node: q, value: q.value.cooked, kind: 'tpl', skip: tagged || isCode }));
    }
  });
  const reps = [], missing = [], used = new Set(), nth = new Map();
  for (const o of occ) {
    if (o.skip) continue;
    const vis = visible(o.value);
    if (!hasLetters(vis)) continue;
    const line = ctxLine(src, o.node.start);
    if (DUMP) DUMP.push({ text: o.value, line, file });
    if (!(o.value in map)) { missing.push({ text: o.value, line }); continue; }
    used.add(o.value);
    let v = map[o.value];
    if (v && typeof v === 'object') {
      if (!(line in (v.at || {}))) { missing.push({ text: o.value, line, ambiguous: true }); continue; }
      let d = v.at[line];
      if (Array.isArray(d)) { const k = o.value + '\u0000' + line, i = nth.get(k) || 0; nth.set(k, i + 1); d = d[i]; } // uma decisão por ocorrência na linha
      v = typeof d === 'string' ? d : d ? v.en : null; // true = tradução de "en"; texto = tradução própria desta linha
    }
    if (v == null || v === o.value) continue;
    if (o.kind === 'lit') {
      const raw = src.slice(o.node.start, o.node.end), q = raw[0];
      reps.push([o.node.start, o.node.end, quote(v, q)]);
    } else {
      reps.push([o.node.start, o.node.end, v.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')]);
    }
  }
  reps.sort((a, b) => b[0] - a[0]);
  let out = src;
  for (const [a, b, t] of reps) out = out.slice(0, a) + t + out.slice(b);
  acorn.parse(out, { ecmaVersion: 'latest', sourceType }); // tem de continuar a ser JS válido
  return { out, missing, used, count: reps.length };
}

const DUMP = process.argv.includes('--all') ? [] : null; // --all: todas as ocorrências (texto + linha) em i18n/all.json
const jobs = [['docs/core.js', 'docs/core.en.js', 'script'], ['docs/app.js', 'docs/app.en.js', 'module']];
const allMissing = []; const usedAll = new Set(); let total = 0;
const results = jobs.map(([from, to, type]) => { const r = processFile(from, type); r.missing.forEach(m => allMissing.push(Object.assign({ file: from }, m))); r.used.forEach(u => usedAll.add(u)); total += r.count; return [to, r]; });
if (DUMP) fs.writeFileSync(path.join(root, 'i18n', 'all.json'), JSON.stringify(DUMP, null, 1));
if (process.argv.includes('--missing')) {
  fs.writeFileSync(path.join(root, 'i18n', 'missing.json'), JSON.stringify(allMissing, null, 1));
  console.log(allMissing.length, 'textos por decidir → i18n/missing.json');
  process.exit(0);
}
if (allMissing.length) {
  console.error(allMissing.length + ' textos sem tradução decidida, p. ex.:');
  allMissing.slice(0, 15).forEach(m => console.error('  ' + JSON.stringify(m.text) + '  ← ' + m.file + ': ' + m.line.slice(0, 100)));
  console.error('Corre com --missing para os ver todos.');
  process.exit(1);
}
const gen = to => '// GERADO por scripts/build-en.mjs a partir de ' + to.replace('.en.js', '.js') + ' e i18n/en.json — não editar à mão.\n';
if (process.argv.includes('--check')) { // só confere que os ficheiros em inglês estão em dia com o app.js
  const stale = results.filter(([to, r]) => !fs.existsSync(path.join(root, to)) || fs.readFileSync(path.join(root, to), 'utf8') !== gen(to) + r.out).map(([to]) => to);
  if (stale.length) { console.error('Desatualizado: ' + stale.join(', ') + ' — corre node scripts/build-en.mjs'); process.exit(1); }
  console.log('Inglês em dia.'); process.exit(0);
}
for (const [to, r] of results) fs.writeFileSync(path.join(root, to), gen(to) + r.out);
const unused = Object.keys(map).filter(k => !usedAll.has(k));
console.log('Inglês gerado:', total, 'textos trocados' + (unused.length ? ' · ' + unused.length + ' entradas do dicionário já não usadas' : ''));
