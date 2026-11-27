// Relatório oficial de lesões da NBA (o "Injury Report" da liga, em PDF, de 15 em 15 minutos):
// https://ak-static.cms.nba.com/referee/injury/Injury-Report_AAAA-MM-DD_HH_MMAM.pdf (hora de Nova Iorque).
// As equipas têm de pôr lá o estado antes dos jogos; a ESPN copia-o mais tarde. Juntamos os dois: o da NBA manda no
// próximo jogo (Out / Doubtful / Questionable / Probable; Available = liberado), a ESPN dá o resto (data de regresso…).
import { playerKey, TEAM_NAMES } from './lib.mjs';

const BASE = 'https://ak-static.cms.nba.com/referee/injury/Injury-Report_';
// as horas em Nova Iorque (com a mudança de hora) sem bibliotecas
function nyParts(ms) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true });
  const o = {}; f.formatToParts(new Date(ms)).forEach(p => { o[p.type] = p.value; });
  return o;
}
// os nomes dos últimos relatórios (do mais recente para trás, de 15 em 15 minutos)
export function nbaReportUrls(now, n = 12) {
  const out = [], q = 15 * 60e3, t0 = Math.floor(now / q) * q;
  for (let i = 0; i < n; i++) {
    const o = nyParts(t0 - i * q), hh = String(o.hour === '24' ? '12' : o.hour).padStart(2, '0');
    out.push(BASE + o.year + '-' + o.month + '-' + o.day + '_' + hh + '_' + o.minute + String(o.dayPeriod).toUpperCase() + '.pdf');
  }
  return out;
}
const STATUS = { out: 'out', doubtful: 'doubtful', questionable: 'questionable', probable: 'probable', available: 'available' };
const HEAD = ['Game', 'Game', 'Matchup', 'Team', 'Player', 'Current', 'Reason'];
const COLS = ['date', 'time', 'matchup', 'team', 'player', 'status', 'reason'];
// itens de texto do PDF ({str, x, y, page}) → linhas {name, team, status, reason, date}. As colunas saem das posições do
// cabeçalho (repete-se em cada página); data, jogo e equipa só vêm na 1.ª linha de cada um e passam para as seguintes.
export function parseNbaReport(items) {
  const lines = new Map();
  items.filter(it => String(it.str).trim()).forEach(it => {
    const k = it.page + ':' + Math.round(it.y / 3);
    if (!lines.has(k)) lines.set(k, { page: it.page, y: it.y, items: [] });
    lines.get(k).items.push(it);
  });
  const L = [...lines.values()].sort((a, b) => a.page - b.page || b.y - a.y);
  L.forEach(l => l.items.sort((a, b) => a.x - b.x));
  let cols = null; const out = []; const carry = { date: '', team: '' };
  for (const l of L) {
    const txt = l.items.map(i => i.str).join(' ');
    if (/Player\s+Name/.test(txt) && /Current\s+Status/.test(txt)) {
      // posição de cada coluna: o 1.º item de cada palavra do cabeçalho, por ordem
      const xs = []; let j = 0;
      for (const it of l.items) { if (j < HEAD.length && String(it.str).trim().startsWith(HEAD[j])) { xs.push(it.x); j++; } }
      if (xs.length === HEAD.length) cols = xs;
      continue;
    }
    if (!cols) continue;
    const cell = {}; COLS.forEach(c => { cell[c] = ''; });
    l.items.forEach(it => { let c = 0; for (let k = 0; k < cols.length; k++) if (it.x >= cols[k] - 4) c = k; cell[COLS[c]] = (cell[COLS[c]] + ' ' + it.str).trim(); });
    // o PDF às vezes junta células vizinhas num só texto: separa-as
    const SW = /^(Out|Doubtful|Questionable|Probable|Available)\b\s*(.*)$/i;
    const mm = cell.matchup.match(/^([A-Z]{2,3}@[A-Z]{2,3})\s+(.+)$/); if (mm && !cell.team) { cell.matchup = mm[1]; cell.team = mm[2]; }
    const ps = cell.player.match(/^(.*?,.*?)\s+(Out|Doubtful|Questionable|Probable|Available)\b\s*(.*)$/i); if (ps && !cell.status) { cell.player = ps[1]; cell.status = ps[2]; cell.reason = (ps[3] + ' ' + cell.reason).trim(); }
    const ss = cell.status.match(SW); if (ss && ss[2]) { cell.status = ss[1]; cell.reason = (ss[2] + ' ' + cell.reason).trim(); }
    const dm = txt.match(/\b(\d{2}\/\d{2}\/\d{4})\b/); if (dm) carry.date = dm[1];
    if (cell.team && !/^Page\b/.test(cell.team) && TEAM_NAMES[cell.team]) carry.team = cell.team;
    const st = STATUS[cell.status.toLowerCase()];
    if (!cell.player || !st || !/,/.test(cell.player)) continue;
    // "Jackson Jr., Jaren" → "Jaren Jackson Jr."
    const i = cell.player.indexOf(','), name = (cell.player.slice(i + 1).trim() + ' ' + cell.player.slice(0, i).trim()).trim();
    const m = carry.date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    out.push({ name, team: TEAM_NAMES[carry.team] || null, status: st, reason: cell.reason || null, date: m ? m[3] + '-' + m[1] + '-' + m[2] : null });
  }
  return out;
}
// lê o PDF (bytes) com o pdf.js e devolve os itens de texto
export async function pdfItems(bytes) {
  // (o Node 20 das tarefas não tem o Promise.withResolvers que o pdf.js usa)
  if (!Promise.withResolvers) Promise.withResolvers = function () { let resolve, reject; const promise = new this((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: false, verbosity: 0 }).promise;
  const items = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    tc.items.forEach(it => { if (it.str != null) items.push({ str: it.str, x: it.transform[4], y: it.transform[5], page: p }); });
  }
  return items;
}
// o relatório mais recente que já saiu (tenta para trás de 15 em 15 minutos); null se nenhum
export async function fetchNbaReport(now, tries = 12) {
  for (const url of nbaReportUrls(now, tries)) {
    let res; try { res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' } }); } catch (e) { continue; }
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.slice(0, 4).toString() !== '%PDF') continue;
    const rows = parseNbaReport(await pdfItems(buf));
    return { url, rows };
  }
  return null;
}
// junta a ESPN com o relatório da NBA. today = AAAA-MM-DD (Nova Iorque): só conta o que é para hoje ou depois.
// O estado da NBA substitui o da ESPN (menos "Fora da época", que fica); Available tira o jogador do relatório.
export function mergeNbaInjuries(espn, nba, { today, at } = {}) {
  const by = new Map(espn.map(r => [r.id, Object.assign({}, r)]));
  const seen = new Set();
  for (const r of nba) {
    if (today && r.date && r.date < today) continue;
    const id = playerKey(r.name); if (!id || seen.has(id)) continue; seen.add(id); // o 1.º jogo que aparece
    const cur = by.get(id);
    if (r.status === 'available') { if (cur && cur.status !== 'ofs') by.delete(id); continue; }
    if (cur && cur.status === 'ofs') continue;
    const lab = { out: 'Out', doubtful: 'Doubtful', questionable: 'Questionable', probable: 'Probable' }[r.status];
    by.set(id, Object.assign({}, cur || { id, name: r.name, team: r.team, detail: null, return_date: null }, {
      status: r.status, label: lab + ' (NBA)', comment: r.reason || (cur && cur.comment) || null, reported_at: at || (cur && cur.reported_at) || null,
      team: (cur && cur.team) || r.team,
    }));
  }
  return [...by.values()];
}
