// Jogos da NBA na Sport TV: o guia (sporttv.pt/guia) é uma página Nuxt e os programas de vários dias vêm em
// /guia/_payload.json, no formato «devalue» (um array em que os valores apontam para outras posições do array).
// Tudo puro (sem rede) para se testar.
import { nbaTeamByName } from './dobra.mjs';

// devalue → objeto normal (com as formas especiais do Nuxt: Reactive, ShallowReactive, Ref, Date, Set, Map…)
export function unflatten(arr) {
  if (!Array.isArray(arr)) return arr;
  const SPECIAL = { '-1': undefined, '-2': null, '-3': NaN, '-4': Infinity, '-5': -Infinity, '-6': -0 };
  const memo = new Map();
  const h = i => {
    if (typeof i !== 'number') return i;
    if (i < 0) return SPECIAL[i];
    if (memo.has(i)) return memo.get(i);
    const v = arr[i];
    if (v === null || typeof v !== 'object') { memo.set(i, v); return v; }
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string') { // forma especial: [tipo, …]
        const t = v[0];
        if (t === 'Date') { memo.set(i, v[1]); return v[1]; }
        if (t === 'Set') { const out = []; memo.set(i, out); v.slice(1).forEach(x => out.push(h(x))); return out; }
        if (t === 'Map') { const out = {}; memo.set(i, out); for (let k = 1; k < v.length; k += 2) out[String(h(v[k]))] = h(v[k + 1]); return out; }
        if (t === 'null') { const out = {}; memo.set(i, out); for (let k = 1; k < v.length; k += 2) out[v[k]] = h(v[k + 1]); return out; }
        if (/^(EmptyRef|EmptyShallowRef)$/.test(t)) { const x = v[1] != null ? JSON.parse(v[1]) : undefined; memo.set(i, x); return x; }
        if (v.length === 2 && typeof v[1] === 'number') { const x = h(v[1]); memo.set(i, x); return x; } // Reactive, Ref, …
        memo.set(i, v); return v;
      }
      const out = []; memo.set(i, out); v.forEach(x => out.push(h(x))); return out;
    }
    const out = {}; memo.set(i, out);
    for (const [k, x] of Object.entries(v)) out[k] = h(x);
    return out;
  };
  return h(0);
}

// canal: «SPORT.TV2», «SPORTTV2», «Sport TV 2» → «SPORT TV 2» (null se não é um canal Sport TV numerado)
export function stvChannel(c) {
  const n = typeof c === 'string' ? c : c && (c.nome || c.name || c.title);
  const m = String(n || '').match(/sport\s*\.?\s*tv\s*(\d)/i);
  return m ? 'SPORT TV ' + m[1] : null;
}

// programas de NBA do guia: [{t: início (ms), a, b (siglas), ch}]. Programa = objeto com canal e data; o jogo é um
// texto «EQUIPA X EQUIPA» com as duas da NBA (magazines como «NBA ACTION» não têm duas equipas)
export function guideNba(root) {
  const out = [], seen = new Set();
  const strs = (o, d = 0, acc = []) => { if (d > 2 || o == null) return acc; if (typeof o === 'string') acc.push(o); else if (typeof o === 'object') Object.values(o).forEach(x => strs(x, d + 1, acc)); return acc; };
  const walk = (o, d = 0) => {
    if (!o || typeof o !== 'object' || d > 40 || seen.has(o)) return; seen.add(o);
    if (!Array.isArray(o) && 'canal' in o && 'data' in o) {
      const ch = stvChannel(o.canal), t = typeof o.data === 'number' ? o.data : Date.parse(o.data);
      if (ch && isFinite(t)) for (const s of strs(o)) {
        const m = s.match(/^\s*(.+?)\s+(?:X|x|vs\.?|-)\s+(.+?)\s*$/); if (!m) continue;
        const a = nbaTeamByName(m[1]), b = nbaTeamByName(m[2]);
        if (a && b && a !== b) { out.push({ t, a, b, ch }); break; }
      }
    }
    (Array.isArray(o) ? o : Object.values(o)).forEach(x => walk(x, d + 1));
  };
  walk(root);
  return out;
}

// liga os programas aos jogos da ESPN ([fora, casa, início ISO, id]): mesmas equipas e a começar até 90 min do jogo
// (as repetições ficam de fora) → {data ET: {'FORA@CASA': 'SPORT TV 2'}}
export function matchTv(items, gamesByDate) {
  const out = {};
  for (const [date, games] of Object.entries(gamesByDate)) for (const g of games) {
    const tip = Date.parse(g[2]); if (!isFinite(tip)) continue;
    const hit = items.find(x => ((x.a === g[0] && x.b === g[1]) || (x.a === g[1] && x.b === g[0])) && Math.abs(x.t - tip) <= 90 * 60e3);
    if (hit) (out[date] = out[date] || {})[g[0] + '@' + g[1]] = hit.ch;
  }
  return out;
}
