// Sonda (manual): a API Atlas da Dapper (Fast Break, classificação, preços) responde sem sessão?
// Resultado nas notas da tarefa.
const note = (t, m) => console.log('::notice title=' + t + '::' + String(m).replace(/\n/g, ' ').slice(0, 3800));
const BASE = 'https://api.production.atlas.dapperlabs.com/';
const headers = { 'content-type': 'application/json', 'connect-protocol-version': '1', accept: 'application/json', origin: 'https://nbatopshot.com', referer: 'https://nbatopshot.com/', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
// "public": a parte pública da API (a que a página do Fast Break usa sem sessão), com pedidos a sério
if (process.argv[2] === 'public') {
  const P = BASE + 'public/atlas.v1.';
  const go = async (m, b) => { try { const r = await fetch(P + m, { method: 'POST', headers, body: JSON.stringify(b) }); const t = await r.text(); note('Pública ' + m, r.status + ' · ' + t.length + ' letras · ' + t.replace(/0x[0-9a-f]{8,}|\b[0-9a-f]{16}\b/gi, '#').replace(/"(username|flowAddress|userFlowAddress|displayName)":"[^"]*"/g, '"$1":"…"').slice(0, 500)); return r.ok ? JSON.parse(t) : null; } catch (e) { note('Pública ' + m, 'erro ' + e.message); return null; } };
  const a = await go('GameEngineService/ListActiveRuns', { product: 'nba' });
  const run = ((a && a.runs) || []).find(r => r.mode === 'RUN_MODE_CLASSIC' && r.league === 'nba');
  if (run) {
    const s = await go('GameEngineService/SearchContests', { product: 'nba', runId: run.id });
    const c = ((s && s.contests) || [])[1];
    if (c) await go('GameEngineService/GetContest', { contestId: c.id });
    await go('LeaderboardService/GetLeaderboardPage', { leaderboardId: run.leaderboardId || 'run:' + run.id, limit: 1, offset: 0 });
    await go('LeaderboardService/GetSubjectRank', { leaderboardId: run.leaderboardId || 'run:' + run.id, subjectId: '0000000000000000' });
  }
  process.exit(0);
}
const M = (process.argv[2] || [
  'GameEngineService/ListActiveRuns', 'GameEngineService/SearchContests', 'GameEngineService/GetContest', 'GameEngineService/GetContestStandings', 'GameEngineService/GetEntry',
  'GameEngineService/GetPlayerSlots', 'GameEngineService/GetGameBoxScores', 'LeaderboardService/GetSubjectRank', 'LeaderboardService/GetLeaderboardPage', 'PlayerService/GetAllPlayers',
  'MarketplaceService/SearchListings', 'ListingService/SearchListings', 'ListingService/GetListings', 'MarketService/GetMarketData', 'EditionService/GetEdition', 'EditionService/SearchEditions',
  'NFTService/GetNFTs', 'PriceService/GetPrices', 'SaleService/GetSales', 'TransactionService/SearchTransactions', 'OfferService/GetOffers'].join(',')).split(',');
for (const m of M) {
  try {
    const r = await fetch(BASE + 'atlas.v1.' + m, { method: 'POST', headers, body: '{}' });
    const t = await r.text();
    note('Atlas ' + m, r.status + ' · ' + (r.headers.get('content-type') || '') + ' · ' + t.slice(0, 700));
  } catch (e) { note('Atlas ' + m, 'erro ' + e.message); }
}
