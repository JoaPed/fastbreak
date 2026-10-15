// Calendário NBA → jogos (com hora e id) de cada dia das runs que ainda não acabaram.
import { supa, must, fetchJson, parseSchedule, etDate, addDays } from './lib.mjs';

const URL = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json';

const sb = await supa();
const { json } = await fetchJson(URL);
if (!json) throw new Error('Não consegui ler o calendário NBA.');
const byDate = parseSchedule(json);
const season = (json.leagueSchedule || {}).seasonYear;
console.log('Calendário', season, '·', Object.keys(byDate).length, 'dias com jogos');

const since = addDays(etDate(Date.now()), -3);
const runs = await must(sb.from('runs').select('id,name,end_date').gte('end_date', since));
let changed = 0;
for (const run of runs) {
  const days = await must(sb.from('run_days').select('run_id,date,games').eq('run_id', run.id));
  for (const d of days) {
    const games = byDate[d.date] || [];
    if (JSON.stringify(games) === JSON.stringify(d.games || [])) continue;
    await must(sb.from('run_days').update({ games }).eq('run_id', run.id).eq('date', d.date));
    changed++;
  }
  console.log('Run', run.name, '·', days.length, 'dias');
}
console.log('Dias atualizados:', changed);
