// Arquivo do Historic: guarda no repositório (docs/data/historic/) os dias jogados de cada run do Historic, para o
// modelo aprender com todas as runs (mais jogos de cada lenda, cortes do top 40, adversários) e para se poder
// comparar o que se previu com o que saiu. Vai buscar o que o leitor do Top Shot trouxe e o site partilhou
// (summaries.share.hist) e junta aos dias já guardados. Corre uma vez por dia (historic.yml) e à mão.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const DIR = process.env.HIST_DIR || 'docs/data/historic';
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), KEY = process.env.SUPABASE_SERVICE_KEY || '';

// só os dias que acabaram (com as linhas das lendas), sem o que é de cada pessoa
export function closedDays(h) {
  return (h.days || []).filter(d => Array.isArray(d.lines) && d.lines.length).map(d => {
    const o = { id: d.id, locks: d.locks || null, status: d.status || null, games: d.games || [], lines: d.lines };
    for (const k of ['bands', 'entries', 'rp', 'top']) if (d[k] != null) o[k] = d[k];
    return o;
  });
}
// junta um documento do Historic ao arquivo da run (dias novos entram; um dia já guardado só muda se vier mais completo)
export function mergeRun(old, h) {
  const out = old ? JSON.parse(JSON.stringify(old)) : { v: 1, run: h.run, rubric: h.rubric || null, budget: h.budget || null, keys: h.keys || [], days: [] };
  if (!out.rubric && h.rubric) out.rubric = h.rubric;
  if (!out.budget && h.budget) out.budget = h.budget;
  // as colunas das linhas seguem as do arquivo: se o leitor mudar a ordem, refaz-se a linha
  const map = (h.keys || []).map(k => out.keys.indexOf(k));
  const remap = l => l.slice(0, 3).concat(out.keys.map((k, i) => { const j = (h.keys || []).indexOf(k); return j >= 0 ? l[3 + j] : 0; }));
  const same = map.length === out.keys.length && map.every((j, i) => j === i);
  let added = 0, changed = 0;
  for (const d of closedDays(h)) {
    const day = same ? d : Object.assign({}, d, { lines: d.lines.map(remap) });
    const i = out.days.findIndex(x => x.id === d.id);
    if (i < 0) { out.days.push(day); added++; continue; }
    const cur = out.days[i];
    if (day.lines.length > cur.lines.length || (!cur.top && day.top) || (!cur.rp && day.rp)) { out.days[i] = Object.assign({}, cur, day); changed++; }
  }
  out.days.sort((a, b) => String(a.locks || a.id).localeCompare(String(b.locks || b.id)));
  out.at = h.at && (!out.at || h.at > out.at) ? h.at : out.at;
  return { doc: out, added, changed };
}
const slug = id => String(id || 'historic').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 80);
export function archive(docs, dir) {
  mkdirSync(dir, { recursive: true });
  const idxPath = dir + '/index.json', idx = existsSync(idxPath) ? JSON.parse(readFileSync(idxPath, 'utf8')) : { v: 1, runs: [] };
  // o mais recente de cada run primeiro não é preciso: junta-se tudo (um membro pode ter lido um dia que outro não leu)
  const byRun = new Map(); docs.filter(h => h && h.run && h.run.id && Array.isArray(h.days)).forEach(h => (byRun.get(h.run.id) || byRun.set(h.run.id, []).get(h.run.id)).push(h));
  let total = 0;
  for (const [runId, list] of byRun) {
    const file = slug(runId) + '.json', path = dir + '/' + file;
    let doc = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null, a = 0, c = 0;
    list.sort((p, q) => String(p.at).localeCompare(String(q.at))).forEach(h => { const r = mergeRun(doc, h); doc = r.doc; a += r.added; c += r.changed; });
    if (!a && !c) continue;
    writeFileSync(path, JSON.stringify(doc));
    const e = { id: runId, name: (doc.run || {}).name || null, file, days: doc.days.length, at: doc.at || null };
    const k = idx.runs.findIndex(x => x.id === runId); if (k < 0) idx.runs.push(e); else idx.runs[k] = e;
    console.log(`${runId}: +${a} dias, ${c} completados (${doc.days.length} no arquivo)`);
    total += a + c;
  }
  if (total) { idx.at = new Date().toISOString(); writeFileSync(idxPath, JSON.stringify(idx, null, 1) + '\n'); }
  return total;
}

// o mesmo que o norm() do site (as chaves das cartas de lendas foram guardadas assim)
export const normName = name => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ı/g, 'i').replace(/ł/g, 'l').replace(/ø/g, 'o').replace(/[đð]/g, 'd').replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/œ/g, 'oe')
  .replace(/[.'’`]/g, '').replace(/-/g, ' ').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim();
// por conta: quantas lendas do Historic têm carta na carteira lida no site ({conta: {lendas, sets}})
export function legendCount(profile, legends) {
  const col = (profile && profile.collection) || {}, out = {};
  if (!col.lg) return null;
  Object.entries(col.lg).forEach(([k, L]) => { if (!legends.has(k)) return; Object.entries((L && L.c) || {}).forEach(([acc, sets]) => { const o = out[acc] || (out[acc] = { lendas: 0, sets: 0 }); o.lendas++; o.sets += (sets || []).length; }); });
  return out;
}
async function legendCards(docs) {
  const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
  const r = await fetch(URL_ + '/rest/v1/profiles?select=display_name,topshot_username,smurfs,collection', { headers: H });
  if (!r.ok) throw new Error('profiles ' + r.status);
  const legends = new Set(); docs.forEach(h => (h.days || []).forEach(d => (d.players || d.lines || []).forEach(x => legends.add(normName(x[1])))));
  for (const p of await r.json()) {
    if (!p.collection) continue;
    const lab = a => a === 'main' ? (p.topshot_username || p.display_name || '?') : ((p.smurfs || []).find(x => x && x.id === a) || {}).topshot_username || a;
    const c = legendCount(p, legends);
    console.log('::notice title=Cartas de lendas::' + (p.topshot_username || p.display_name || '?') + ' · carteira lida ' + String(p.collection.read_at || '?').slice(0, 16) + ' · ' +
      (c == null ? 'leitura antiga, sem lendas (ler a carteira outra vez)' : Object.keys(c).length ? Object.entries(c).map(([a, x]) => lab(a) + ': ' + x.lendas + ' lendas do Historic').join(' · ') : 'nenhuma lenda do Historic com carta'));
  }
}

if (import.meta.url === 'file://' + process.argv[1]) {
  let docs = [];
  if (process.argv[2]) docs = process.argv.slice(2).map(f => JSON.parse(readFileSync(f, 'utf8'))); // à mão: ficheiros do favorito "FB historic dados"
  else {
    if (!URL_ || !KEY) { console.log('Sem SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(0); }
    const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
    const r = await fetch(URL_ + '/rest/v1/summaries?select=share', { headers: H });
    if (!r.ok) { console.log('::warning::summaries ' + r.status); process.exit(1); }
    docs = (await r.json()).map(x => x.share && x.share.hist).filter(Boolean);
    // diagnóstico (só contagens): o que cada leitura trouxe de cada dia
    docs.forEach(h => console.log('::notice title=Historic lido::' + h.at + ' · ' + (h.days || []).map(d => String(d.id).split('-').pop() + ':' + (d.lines && d.lines.length ? 'L' : d.players ? 'P' : '-') + (d.mine ? 'm' + Object.keys(d.mine).length : '') + (d.no ? 'n' + d.no.length : '') + (d.top ? 't' : '') + (d.mineErr ? '!' : '')).join(' ') + ((h.days || []).find(d => d.mineErr) ? ' · erro: ' + (h.days.find(d => d.mineErr).mineErr) : '') + ((h.days || []).find(d => d.ceKeys) ? ' · callerEntry: ' + h.days.find(d => d.ceKeys).ceKeys.join(',') : '')));
  }
  // cartas de lendas lidas nas carteiras (desconto de colecionador no Historic): só contagens por conta, para ver se a
  // leitura da carteira já as trouxe (o que cada um tem fica no site; aqui só quantas lendas do Historic e de que raridade)
  if (!process.argv[2]) { try { await legendCards(docs); } catch (e) { console.log('::warning::cartas de lendas: ' + e.message); } }
  const n = archive(docs, DIR);
  console.log(n ? `::notice::Historic: ${n} dias novos ou completados no arquivo` : 'Historic: nada de novo');
}
