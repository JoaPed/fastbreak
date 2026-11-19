// Dobradinha do dia: duas apostas de jogos DIFERENTES (quem ganha, handicap ou linha de um jogador) cuja odd junta
// fica perto de 2, com a maior hipótese de as duas baterem. Escada: cada dobradinha que bate sobe um degrau (até 8);
// quando falha volta ao 1. Recomeça em cada run. Tudo puro (sem rede) para se testar.
import { norm, espnTeam, SGO_STAT } from './lib.mjs';

// alcunhas → sigla (a SportsGameOdds dá os nomes das equipas; a sigla liga aos jogos da ESPN)
const NICK = { hawks: 'ATL', celtics: 'BOS', nets: 'BKN', hornets: 'CHA', bulls: 'CHI', cavaliers: 'CLE', mavericks: 'DAL', nuggets: 'DEN', pistons: 'DET', warriors: 'GSW', rockets: 'HOU', pacers: 'IND', clippers: 'LAC', lakers: 'LAL', grizzlies: 'MEM', heat: 'MIA', bucks: 'MIL', timberwolves: 'MIN', pelicans: 'NOP', knicks: 'NYK', thunder: 'OKC', magic: 'ORL', '76ers': 'PHI', sixers: 'PHI', suns: 'PHX', 'trail blazers': 'POR', blazers: 'POR', kings: 'SAC', spurs: 'SAS', raptors: 'TOR', jazz: 'UTA', wizards: 'WAS' };
export function sgoTeam(t) {
  if (!t) return null;
  const n = t.names || {}, s = String(n.short || n.abbreviation || '').toUpperCase();
  if (/^[A-Z]{2,4}$/.test(s)) { const e = espnTeam(s); if (Object.values(NICK).includes(e)) return e; }
  const txt = String(n.long || n.medium || n.full || t.teamID || '').toLowerCase().replace(/_nba$/, '').replace(/_/g, ' ');
  for (const [k, v] of Object.entries(NICK)) if (txt.endsWith(k) || txt.includes(' ' + k)) return v;
  return null;
}
export const toDec = a => { a = +a; if (!isFinite(a) || a === 0) return null; return a > 0 ? 1 + a / 100 : 1 + 100 / -a; };
const pOf = a => { const d = toDec(a); return d ? 1 / d : null; };
const half = x => Math.abs(x * 2 % 2) === 1; // linha .5: não há empate

// todas as apostas possíveis de um jogo da SportsGameOdds
export function sgoLegs(ev, nameOf) {
  const out = [], odds = (ev && ev.odds) || {}, T = (ev && ev.teams) || {};
  const home = sgoTeam(T.home), away = sgoTeam(T.away), tip = ev && ev.status && ev.status.startsAt;
  if (!home || !away) return out;
  const g = away + '@' + home;
  const pair = o => odds[String(o.oddID || '').replace(/-(home|away|over|under)$/, m => ({ '-home': '-away', '-away': '-home', '-over': '-under', '-under': '-over' })[m])];
  for (const o of Object.values(odds)) {
    if (!o || o.periodID !== 'game' || o.available === false) continue;
    // odd que se paga: a MAIS BAIXA das casas com a mesma linha (o consenso e até a mediana saem altos demais: na casa
    // do grupo, a 19 nov, Portland estava a 1,21 contra 1,47 de mediana); com menos de 2 casas fica de fora
    const lineOf = x => (x == null ? null : +x), main = lineOf(o.bookOverUnder ?? o.bookSpread);
    const ds = Object.values(o.byBookmaker || {}).filter(b => b && b.available !== false && (main == null || lineOf(b.overUnder ?? b.spread) == null || lineOf(b.overUnder ?? b.spread) === main)).map(b => toDec(b.odds)).filter(Boolean).sort((a, b) => a - b);
    if (ds.length < 2) continue;
    const d = ds[0];
    let p = pOf(o.fairOdds); if (p == null) { const u = pair(o), a = pOf(o.bookOdds), b = u && pOf(u.bookOdds); p = a != null && b != null ? a / (a + b) : null; }
    if (p == null) continue;
    const base = { g, home, away, tip, o: Math.round(d * 100) / 100, p: Math.round(p * 1000) / 1000, nb: ds.length, lo: Math.round(ds[0] * 100) / 100 };
    if (o.betTypeID === 'ml' && o.statID === 'points' && (o.sideID === 'home' || o.sideID === 'away')) out.push(Object.assign(base, { k: 'ml', t: o.sideID === 'home' ? home : away }));
    else if (o.betTypeID === 'sp' && o.statID === 'points' && (o.sideID === 'home' || o.sideID === 'away')) {
      const line = +(o.bookSpread ?? o.fairSpread); if (!isFinite(line) || !half(line)) continue;
      out.push(Object.assign(base, { k: 'sp', t: o.sideID === 'home' ? home : away, line }));
    // linhas de jogadores: só os «mais de» (na casa do grupo dá para escolher a linha do over; a do under não se mexe)
    } else if (o.betTypeID === 'ou' && o.sideID === 'over' && SGO_STAT[o.statID] && !['home', 'away', 'all'].includes(o.statEntityID)) {
      const line = +(o.bookOverUnder ?? o.fairOverUnder); if (!isFinite(line) || !half(line)) continue;
      out.push(Object.assign(base, { k: 'pr', who: nameOf(ev, o.statEntityID), stat: SGO_STAT[o.statID], side: o.sideID, line }));
    }
  }
  return out;
}

// a melhor dobradinha: jogos diferentes, odd junta entre lo e hi, cada perna com pelo menos minP de hipótese;
// escolhe a de maior valor esperado (hipótese × odd − 1: a que menos perde para a margem das casas) e, em empate, a
// mais provável. skip(leg) tira pernas (jogadores em dúvida, jogos a começar…)
export function pickDouble(legs, { lo = 1.9, hi = 2.2, minP = 0.5, skip = () => false } = {}) {
  const L = legs.filter(x => x.p >= minP && x.o >= 1.15 && !skip(x)).sort((a, b) => b.p - a.p).slice(0, 400);
  let best = null;
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j]; if (a.g === b.g) continue; // sempre de jogos diferentes
    const o = a.o * b.o; if (o < lo || o > hi) continue;
    const p = a.p * b.p, ev = p * o - 1;
    if (!best || ev > best.ev + 1e-9 || (Math.abs(ev - best.ev) < 1e-9 && p > best.p)) best = { legs: [a, b], o: Math.round(o * 100) / 100, p: Math.round(p * 1000) / 1000, ev: Math.round(ev * 1000) / 1000 };
  }
  return best;
}

// resultado de uma perna: scores = {sigla: pontos}, box = {nomeNormalizado: {pts, reb…}}; null = ainda não se sabe
export function settleLeg(leg, scores, box) {
  if (leg.k === 'ml' || leg.k === 'sp') {
    const mine = scores[leg.t], other = scores[leg.t === leg.home ? leg.away : leg.home];
    if (mine == null || other == null) return null;
    return leg.k === 'ml' ? mine > other : mine + leg.line > other;
  }
  const s = box[norm(leg.who)];
  if (!s) return 'dnp'; // não jogou: a casa anula a perna
  const v = String(leg.stat).split('+').reduce((t, k) => t + (+s[k] || 0), 0);
  return leg.side === 'over' ? v > leg.line : v < leg.line;
}
// a dobradinha inteira: 'win' / 'loss' / null (por decidir). Perna anulada (não jogou) conta como ganha (a odd fica a da outra)
export function settleDouble(d, scores, box) {
  const r = d.legs.map(l => settleLeg(l, scores, box));
  if (r.some(x => x === false)) return 'loss';
  if (r.some(x => x === null)) return null;
  return 'win';
}
// a escada de uma run: dobradinhas por ordem de data → degrau de cada uma (1 a 8), a melhor e os recomeços
export function ladder(list) {
  let step = 1, best = 0, restarts = 0; const out = [];
  for (const d of list) {
    out.push(Object.assign({}, d, { step }));
    if (d.res === 'win') { best = Math.max(best, step); step = step >= 8 ? 1 : step + 1; }
    else if (d.res === 'loss') { best = Math.max(best, step - 1); restarts++; step = 1; }
  }
  return { list: out, step, best, restarts };
}
// placar da ESPN → {sigla: pontos} dos jogos acabados
export function espnScores(json) {
  const out = {};
  for (const ev of (json && json.events) || []) {
    const comp = (ev.competitions || [])[0] || {};
    if (!((comp.status || ev.status || {}).type || {}).completed) continue;
    for (const c of comp.competitors || []) { const a = espnTeam((c.team || {}).abbreviation); if (a) out[a] = +c.score; }
  }
  return out;
}
// texto do Telegram (em inglês, como o resto do aviso)
const STAT_EN = { pts: 'points', reb: 'rebounds', ast: 'assists', fg3: 'threes', stl: 'steals', blk: 'blocks', tov: 'turnovers', fgm: 'field goals', ftm: 'free throws', fta: 'free throws att.', oreb: 'off. rebounds', dreb: 'def. rebounds', fga: 'FG attempts', fg3a: '3PT attempts' };
export function dobraText(d, step) {
  if (!d || !Array.isArray(d.legs)) return '';
  const leg = l => l.k === 'ml' ? '<b>' + l.t + '</b> win' : l.k === 'sp' ? '<b>' + l.t + '</b> ' + (l.line > 0 ? '+' : '') + l.line : '<b>' + l.who + '</b> ' + (l.side === 'over' ? '+' + l.line : 'under ' + l.line) + ' ' + (STAT_EN[l.stat] || l.stat);
  return '\n\n🎯 <b>Daily double</b>' + (step ? ' (step ' + step + ' of 8)' : '') + ': ' + d.legs.map(leg).join(' + ') + ' · odds ' + d.o.toFixed(2) + ' · ' + Math.round(d.p * 100) + '% both hit';
}
