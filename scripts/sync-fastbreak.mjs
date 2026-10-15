// Blockchain Flow (contrato FastBreakV1 do Top Shot) → runs, dias, objetivos e resultados de cada membro.
// 1) lê os eventos novos (runs e dias criados, objetivos adicionados) desde a última vez;
// 2) para cada membro com utilizador Top Shot: lineups submetidos, pontos e vitórias;
// 3) nas runs do site ligadas a uma run da blockchain, preenche os objetivos de cada dia.
// Uso: node scripts/sync-fastbreak.mjs [--backfill N]   (N = blocos para trás na primeira leitura; ~1 bloco/s)
import { supa, must, getState, setState, flowScript, flowEvents, flowLatestHeight, etDate, objectivesFromStats, cadence, pool, FASTBREAK } from './lib.mjs';

const sb = await supa();
const nowS = Math.floor(Date.now() / 1000);
const argB = process.argv.indexOf('--backfill');
const BACKFILL = argB > 0 ? Math.max(0, parseInt(process.argv[argB + 1], 10) || 0) : 0;
const argD = process.argv.indexOf('--since-days');
const SINCE_DAYS = argD > 0 ? Math.max(1, parseInt(process.argv[argD + 1], 10) || 45) : 45; // lineups dos últimos N dias
const CHUNK = 250, MAX_CHUNKS = +(process.env.FLOW_MAX_CHUNKS || 600);

const GAMES_SCRIPT = `
import FastBreakV1 from 0x0b2a3299cc857e29
access(all) fun main(ids: [String]): [{String: AnyStruct}] {
  let out: [{String: AnyStruct}] = []
  for id in ids {
    if let g = FastBreakV1.getFastBreakGame(id: id) {
      let stats: [{String: AnyStruct}] = []
      if let st = FastBreakV1.getFastBreakGameStats(id: id) {
        for s in st {
          let e: {String: AnyStruct} = {"name": s.name, "type": s.type.rawValue, "valueNeeded": s.valueNeeded}
          stats.append(e)
        }
      }
      let row: {String: AnyStruct} = {"id": g.id, "name": g.name, "runId": g.fastBreakRunID, "deadline": g.submissionDeadline, "numPlayers": g.numPlayers, "status": g.status.rawValue, "stats": stats}
      out.append(row)
    }
  }
  return out
}`;
const RUNS_SCRIPT = `
import FastBreakV1 from 0x0b2a3299cc857e29
access(all) fun main(ids: [String]): [{String: AnyStruct}] {
  let out: [{String: AnyStruct}] = []
  for id in ids {
    if let r = FastBreakV1.getFastBreakRun(id: id) {
      let row: {String: AnyStruct} = {"id": r.id, "name": r.name, "runStart": r.runStart, "runEnd": r.runEnd, "status": r.status.rawValue}
      out.append(row)
    }
  }
  return out
}`;
const PLAYER_SCRIPT = `
import FastBreakV1 from 0x0b2a3299cc857e29
import TopShot from 0x0b2a3299cc857e29
access(all) fun main(addr: Address, runIds: [String], since: UInt64): [{String: AnyStruct}] {
  let acct = getAccount(addr)
  let out: [{String: AnyStruct}] = []
  let col = acct.capabilities.borrow<&{FastBreakV1.FastBreakNFTCollectionPublic}>(FastBreakV1.CollectionPublicPath)
  if col == nil { return out }
  let moments = acct.capabilities.borrow<&{TopShot.MomentCollectionPublic}>(/public/MomentCollection)
  for id in col!.getIDs() {
    if let nft = col!.borrowFastBreakNFT(id: id) {
      if let game = FastBreakV1.getFastBreakGame(id: nft.fastBreakGameID) {
        if game.submissionDeadline < since { continue }
        if runIds.length > 0 && !runIds.contains(game.fastBreakRunID) { continue }
        let ids: [UInt64] = []
        let names: [String] = []
        for mid in nft.topShots {
          ids.append(mid)
          var n = ""
          if moments != nil {
            if let m = moments!.borrowMoment(id: mid) {
              n = TopShot.getPlayMetaDataByField(playID: m.data.playID, field: "FullName") ?? ""
            }
          }
          names.append(n)
        }
        let row: {String: AnyStruct} = {"gameId": game.id, "runId": game.fastBreakRunID, "deadline": game.submissionDeadline, "status": game.status.rawValue, "points": nft.points(), "win": nft.isWinner(), "topShots": ids, "names": names, "playerId": nft.mintedTo}
        out.append(row)
      }
    }
  }
  return out
}`;

// ---------- 1) eventos ----------
const flow = await getState(sb, 'flow', {});
const latest = await flowLatestHeight();
let start = flow.height ? flow.height + 1 : latest - (BACKFILL || 20000);
if (BACKFILL && flow.height) start = Math.min(start, latest - BACKFILL);
const end = Math.min(latest, start + CHUNK * MAX_CHUNKS - 1);
console.log('Blocos', start, '→', end, '(último selado', latest + ')');
const ranges = [];
for (let s = start; s <= end; s += CHUNK) ranges.push([s, Math.min(end, s + CHUNK - 1)]);
const types = ['FastBreakRunCreated', 'FastBreakGameCreated', 'FastBreakGameStatAdded'].map(t => FASTBREAK + '.' + t);
const events = [];
let failed = 0;
await pool(ranges, 4, async ([a, b]) => {
  for (const t of types) {
    try { events.push(...await flowEvents(t, a, b)); }
    catch (e) { failed++; if (failed < 5) console.log('  erro', a, b, String(e.message).slice(0, 200)); }
  }
});
console.log('Eventos:', events.length, failed ? '· falhas ' + failed : '');
const runIds = new Set(), gameIds = new Set();
for (const ev of events) {
  const d = ev.data || {};
  if (ev.type.endsWith('RunCreated')) {
    runIds.add(d.id);
    await must(sb.from('chain_runs').upsert({ id: d.id, name: d.name, run_start: d.runStart, run_end: d.runEnd, updated_at: new Date().toISOString() }));
  } else if (ev.type.endsWith('GameCreated')) {
    gameIds.add(d.id); runIds.add(d.fastBreakRunID);
  } else if (ev.type.endsWith('GameStatAdded')) {
    gameIds.add(d.fastBreakGameID);
  }
}
if (!failed) await setState(sb, 'flow', { height: end, at: new Date().toISOString() });
else if (failed < ranges.length * types.length) await setState(sb, 'flow', { height: Math.max(flow.height || 0, start - 1), at: new Date().toISOString(), lastErrors: failed });

// ---------- 2) resultados dos membros ----------
const linked = (await must(sb.from('runs').select('id,chain_run_id').not('chain_run_id', 'is', null))).map(r => r.chain_run_id);
const profiles = await must(sb.from('profiles').select('user_id,topshot_username,flow_address'));
const members = new Set((await must(sb.from('members').select('user_id'))).map(m => m.user_id));
const since = nowS - SINCE_DAYS * 86400;
const profilesWithTs = profiles.filter(p => members.has(p.user_id) && (p.topshot_username || p.flow_address));
if (!profilesWithTs.length) console.log('Nenhum membro com utilizador do Top Shot no perfil: não há resultados para ler.');
for (const p of profiles) {
  if (!members.has(p.user_id)) continue;
  let addr = p.flow_address;
  if (!addr && p.topshot_username) {
    addr = await topShotAddress(p.topshot_username);
    if (addr) await must(sb.from('profiles').update({ flow_address: addr }).eq('user_id', p.user_id));
  }
  if (!addr) { if (p.topshot_username) console.log('Sem endereço Flow para', p.topshot_username); continue; }
  let rows;
  try { rows = await flowScript(PLAYER_SCRIPT, [cadence.address(addr), cadence.strings(linked), { type: 'UInt64', value: String(since) }]); }
  catch (e) { console.log('Erro a ler', p.topshot_username || addr, String(e.message).slice(0, 300)); continue; }
  const out = (rows || []).map(r => {
    runIds.add(r.runId); gameIds.add(r.gameId);
    return { user_id: p.user_id, game_id: r.gameId, chain_run_id: r.runId, date: etDate(r.deadline * 1000), points: r.points, win: !!r.win, lineup: (r.names || []).filter(Boolean), updated_at: new Date().toISOString() };
  });
  if (out.length) await must(sb.from('chain_results').upsert(out, { onConflict: 'user_id,game_id' }));
  console.log((p.topshot_username || addr) + ':', out.length, 'dias lidos,', out.filter(x => x.win).length, 'vitórias');
}

// ---------- 3) detalhes de runs e dias; objetivos ----------
for (const id of linked) runIds.add(id);
const knownGames = await must(sb.from('chain_games').select('id').in('run_id', linked.length ? linked : ['-']));
knownGames.forEach(g => gameIds.add(g.id));
const runList = [...runIds].filter(Boolean);
for (let i = 0; i < runList.length; i += 20) {
  const info = await flowScript(RUNS_SCRIPT, [cadence.strings(runList.slice(i, i + 20))]);
  for (const r of info || []) await must(sb.from('chain_runs').upsert({ id: r.id, name: r.name, run_start: r.runStart, run_end: r.runEnd, status: r.status, updated_at: new Date().toISOString() }));
}
const gameList = [...gameIds].filter(Boolean);
const games = [];
for (let i = 0; i < gameList.length; i += 20) games.push(...(await flowScript(GAMES_SCRIPT, [cadence.strings(gameList.slice(i, i + 20))]) || []));
if (games.length) {
  await must(sb.from('chain_games').upsert(games.map(g => ({ id: g.id, run_id: g.runId, name: g.name, deadline: g.deadline, num_players: g.numPlayers, stats: g.stats || [], status: g.status, updated_at: new Date().toISOString() }))));
}
console.log('Runs na blockchain:', runList.length, '· dias:', games.length);
const named = await must(sb.from('chain_runs').select('name,run_start').order('run_start', { ascending: false }).limit(8));
if (named.length) console.log('Runs conhecidas:', named.map(r => r.name).join(' | '));
const statNames = [...new Set(games.flatMap(g => (g.stats || []).map(s => s.name + (s.type === 0 ? ' (cada jogador)' : ''))))];
if (statNames.length) console.log('Estatísticas usadas nos dias lidos:', statNames.join(', '));

const siteRuns = await must(sb.from('runs').select('id,name,chain_run_id').not('chain_run_id', 'is', null));
for (const run of siteRuns) {
  const cg = await must(sb.from('chain_games').select('*').eq('run_id', run.chain_run_id));
  const days = await must(sb.from('run_days').select('date,objectives,chain_game_id').eq('run_id', run.id));
  const byDate = new Map(days.map(d => [d.date, d]));
  let n = 0;
  for (const g of cg) {
    const date = etDate(g.deadline * 1000), day = byDate.get(date);
    if (!day) { console.log('  ', run.name, ': dia', date, 'da blockchain não existe no site'); continue; }
    const { objs, unknown } = objectivesFromStats(g.stats);
    if (unknown.length) console.log('  estatística desconhecida em', date, ':', unknown.join(', '));
    const patch = { chain_game_id: g.id };
    if (objs.length) patch.objectives = objs;
    if (day.chain_game_id === g.id && JSON.stringify(day.objectives) === JSON.stringify(patch.objectives || day.objectives)) continue;
    await must(sb.from('run_days').update(patch).eq('run_id', run.id).eq('date', date));
    n++;
  }
  console.log('Run', run.name, '· dias atualizados a partir da blockchain:', n);
}

async function topShotAddress(username) {
  const query = 'query ($input: getUserProfileByUsernameInput!) { getUserProfileByUsername(input: $input) { publicInfo { flowAddress username } } }';
  try {
    const res = await fetch('https://public-api.nbatopshot.com/graphql', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 fastbreak-planner' }, body: JSON.stringify({ query, variables: { input: { username } } }) });
    const js = await res.json();
    const a = (((js.data || {}).getUserProfileByUsername || {}).publicInfo || {}).flowAddress;
    if (!a) { console.log('Top Shot não devolveu endereço para', username, JSON.stringify(js.errors || '').slice(0, 200)); return null; }
    const hex = String(a).replace(/^0x/, '');
    return /^[0-9a-fA-F]{16}$/.test(hex) ? '0x' + hex.toLowerCase() : null;
  } catch (e) { console.log('Erro na API do Top Shot:', e.message); return null; }
}
