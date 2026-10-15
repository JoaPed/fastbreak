// Blockchain Flow (contrato FastBreakV1 do Top Shot) → runs, dias, objetivos e resultados de cada membro.
// 1) lê os eventos novos (runs e dias criados, objetivos adicionados) desde a última vez;
// 2) para cada membro (e as suas contas smurf) com endereço Flow: lineups submetidos, pontos e vitórias;
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
let profiles, hasAccounts = true;
try { profiles = await must(sb.from('profiles').select('user_id,topshot_username,flow_address,smurfs')); }
catch (e) { // base de dados ainda sem as colunas das contas smurf
  hasAccounts = false;
  console.log('Aviso: corre o supabase/schema.sql novo no Supabase para ler as contas smurf (' + e.message + ').');
  profiles = await must(sb.from('profiles').select('user_id,topshot_username,flow_address'));
}
const members = new Set((await must(sb.from('members').select('user_id'))).map(m => m.user_id));
const since = nowS - SINCE_DAYS * 86400;
// cada membro pode ter a conta principal e até 2 smurf: lê os resultados de todas
const accounts = [];
for (const p of profiles) {
  if (!members.has(p.user_id)) continue;
  accounts.push({ user_id: p.user_id, account: 'main', username: p.topshot_username, addr: p.flow_address, profile: p });
  for (const sm of Array.isArray(p.smurfs) ? p.smurfs : []) if (sm && sm.id) accounts.push({ user_id: p.user_id, account: sm.id, username: sm.topshot_username, addr: sm.flow_address });
}
if (!accounts.some(a => a.username || a.addr)) console.log('Nenhum membro com utilizador do Top Shot no perfil: não há resultados para ler.');
for (const acc of accounts) {
  let addr = acc.addr;
  if (!addr && acc.username) {
    addr = await topShotAddress(acc.username);
    if (addr && acc.account === 'main') await must(sb.from('profiles').update({ flow_address: addr }).eq('user_id', acc.user_id));
  }
  const label = (acc.username || addr || '?') + (acc.account !== 'main' ? ' (smurf)' : '');
  if (!addr) { if (acc.username) console.log('Sem endereço Flow para', label); continue; }
  let rows;
  try { rows = await flowScript(PLAYER_SCRIPT, [cadence.address(addr), cadence.strings(linked), { type: 'UInt64', value: String(since) }]); }
  catch (e) { console.log('Erro a ler', label, String(e.message).slice(0, 300)); continue; }
  const out = (rows || []).map(r => {
    runIds.add(r.runId); gameIds.add(r.gameId);
    return { user_id: acc.user_id, account: acc.account, game_id: r.gameId, chain_run_id: r.runId, date: etDate(r.deadline * 1000), points: r.points, win: !!r.win, lineup: (r.names || []).filter(Boolean), updated_at: new Date().toISOString() };
  });
  if (!hasAccounts) out.forEach(o => { delete o.account; });
  if (out.length) await must(sb.from('chain_results').upsert(out, { onConflict: hasAccounts ? 'user_id,game_id,account' : 'user_id,game_id' }));
  console.log(label + ':', out.length, 'dias lidos,', out.filter(x => x.win).length, 'vitórias');
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

async function topShotAddress(raw) {
  const username = String(raw || '').trim().replace(/^@+/, '');
  const query = 'query ($input: getUserProfileByUsernameInput!) { getUserProfileByUsername(input: $input) { publicInfo { flowAddress username } } }';
  const headers = { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', origin: 'https://nbatopshot.com', referer: 'https://nbatopshot.com/' };
  for (const url of ['https://public-api.nbatopshot.com/graphql', 'https://nbatopshot.com/marketplace/graphql']) {
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query, variables: { input: { username } } }) });
      const text = await res.text();
      if (!text.trim().startsWith('{')) { console.log('  Top Shot (' + url.split('/')[2] + ') recusou o pedido (HTTP ' + res.status + ').'); continue; }
      const js = JSON.parse(text);
      const a = (((js.data || {}).getUserProfileByUsername || {}).publicInfo || {}).flowAddress;
      if (!a) { console.log('  Top Shot não devolveu endereço para', username, JSON.stringify(js.errors || '').slice(0, 200)); continue; }
      const hex = String(a).replace(/^0x/, '');
      if (/^[0-9a-fA-F]{16}$/.test(hex)) return '0x' + hex.toLowerCase();
    } catch (e) { console.log('  Erro na API do Top Shot:', e.message); }
  }
  console.log('  → põe o endereço Flow da carteira Dapper à mão no perfil do site (Ajustes → Perfil).');
  return null;
}
