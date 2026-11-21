// Que jogos da NBA dão na Sport TV (e em que canal), a partir do guia da Sport TV. Guarda em odds_days.players._tv
// ({'FORA@CASA': 'SPORT TV 2'}) de cada data (ET) — sem mudar a base. Corre com a tarefa do calendário.
import { supa, must, fetchJson, parseEspnScoreboard, etDate, addDays } from './lib.mjs';
import { unflatten, guideNba, matchTv } from './tv.mjs';

const sb = await supa();
let items = [];
try {
  const res = await fetch('https://www.sporttv.pt/guia/_payload.json', { headers: { 'user-agent': 'Mozilla/5.0 (fastbreak; guia de TV)', accept: 'application/json' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  items = guideNba(unflatten(await res.json()));
} catch (e) { console.log('::warning::guia da Sport TV: ' + String(e.message || e).slice(0, 120)); process.exit(0); }
console.log('Sport TV: ' + items.length + ' jogos da NBA no guia; p. ex. ' + items.slice(0, 4).map(x => x.a + '-' + x.b + ' ' + new Date(x.t).toISOString().slice(5, 16) + ' ' + x.ch).join(' · '));
const today = etDate(new Date()), byDate = {};
for (let k = -1; k <= 3; k++) {
  const date = addDays(today, k);
  try { const { json } = await fetchJson('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=' + date.replace(/-/g, '')); byDate[date] = json ? parseEspnScoreboard(json) : []; } catch (e) { byDate[date] = []; }
}
const tv = matchTv(items, byDate);
console.log('jogos da ESPN: ' + Object.entries(byDate).map(([d, g]) => d + ' ' + g.length + (g[0] ? ' (' + g[0][0] + '@' + g[0][1] + ' ' + g[0][2] + ')' : '')).join(' · '));
for (const date of Object.keys(byDate)) {
  const got = tv[date] || {};
  const prev = await must(sb.from('odds_days').select('players').eq('date', date).maybeSingle());
  if (!prev && !Object.keys(got).length) continue;
  const players = Object.assign({}, (prev && prev.players) || {}, { _tv: got });
  if (JSON.stringify((prev && prev.players || {})._tv || {}) === JSON.stringify(got)) continue;
  await must(sb.from('odds_days').upsert({ date, players, updated_at: new Date().toISOString() }));
  console.log(date + ': ' + (Object.entries(got).map(([g, c]) => g + ' ' + c).join(', ') || 'nenhum'));
}
