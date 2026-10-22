// Sonda (manual): a API Atlas da Dapper (Fast Break, classificação, preços) responde sem sessão?
// Resultado nas notas da tarefa.
const note = (t, m) => console.log('::notice title=' + t + '::' + String(m).replace(/\n/g, ' ').slice(0, 3800));
const BASE = 'https://api.production.atlas.dapperlabs.com/';
const headers = { 'content-type': 'application/json', 'connect-protocol-version': '1', accept: 'application/json', origin: 'https://nbatopshot.com', referer: 'https://nbatopshot.com/', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
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
