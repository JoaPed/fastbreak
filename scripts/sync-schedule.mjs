// Calendário (ESPN) → jogos de cada dia das runs que ainda não acabaram: [fora, casa, inícioISO, 'espn:<id>'].
import { supa, must, fetchJson, parseEspnScoreboard, etDate, addDays, pool } from './lib.mjs';

const SCOREBOARD = date => 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=' + date.replace(/-/g, '');

const sb = await supa();
const since = addDays(etDate(Date.now()), -3);
const runs = await must(sb.from('runs').select('id,name,end_date').gte('end_date', since));
if (!runs.length) console.log('Nenhuma run por acabar: nada a fazer.');
let changed = 0, failed = 0;
for (const run of runs) {
  const days = await must(sb.from('run_days').select('run_id,date,games').eq('run_id', run.id));
  await pool(days, 4, async d => {
    let json = null;
    try { ({ json } = await fetchJson(SCOREBOARD(d.date))); } catch (e) { failed++; return; }
    if (!json) { failed++; return; }
    const games = parseEspnScoreboard(json);
    if (JSON.stringify(games) === JSON.stringify(d.games || [])) return;
    await must(sb.from('run_days').update({ games }).eq('run_id', run.id).eq('date', d.date));
    changed++;
  });
  console.log('Run', run.name, '·', days.length, 'dias');
}
console.log('Dias atualizados:', changed, failed ? '· sem resposta da ESPN: ' + failed : '');
if (failed && !changed) process.exitCode = 1;
