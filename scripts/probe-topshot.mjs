// Sonda (manual): o que a API pública do Top Shot (GraphQL) tem sobre o Fast Break (classificação, posição).
// Resultado nas notas da tarefa. Uso: node scripts/probe-topshot.mjs [utilizador]
const USER = process.argv[2] || 'gandapanasco';
const headers = { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', origin: 'https://nbatopshot.com', referer: 'https://nbatopshot.com/' };
const note = (t, m) => console.log('::notice title=' + t + '::' + String(m).replace(/\n/g, ' ').slice(0, 3800));
async function gql(url, query, variables) {
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
    const text = await res.text();
    if (!text.trim().startsWith('{')) return { http: res.status, raw: text.slice(0, 200) };
    return JSON.parse(text);
  } catch (e) { return { err: e.message }; }
}
const URLS = ['https://public-api.nbatopshot.com/graphql', 'https://nbatopshot.com/marketplace/graphql'];
for (const url of URLS) {
  const host = url.split('/')[2] + url.slice(url.indexOf('/', 8));
  // 1) introspeção: nomes das queries
  const r = await gql(url, '{ __schema { queryType { fields { name args { name type { name kind ofType { name } } } } } } }');
  const fields = (((r.data || {}).__schema || {}).queryType || {}).fields || [];
  if (fields.length) {
    note('Top Shot ' + host, fields.length + ' queries · Fast Break/leaderboard: ' + fields.filter(f => /fast|break|leader|rank|run|contest|challenge/i.test(f.name)).map(f => f.name + '(' + f.args.map(a => a.name + ':' + (a.type.name || (a.type.ofType || {}).name || a.type.kind)).join(',') + ')').join(' · '));
    note('Top Shot ' + host + ' (todas)', fields.map(f => f.name).join(', '));
  } else note('Top Shot ' + host, 'sem introspeção: ' + JSON.stringify(r).slice(0, 400));
  // 2) palpites (os erros do GraphQL costumam sugerir nomes: "Did you mean ...")
  for (const q of ['{ searchFastBreaks { __typename } }', '{ getFastBreakRun { __typename } }', '{ fastBreakLeaderboard { __typename } }', '{ getFastBreakLeaderboard { __typename } }', '{ searchLeaderboards { __typename } }', '{ getLeaderboard { __typename } }', '{ fastBreak { __typename } }', '{ getFastBreakRuns { __typename } }']) {
    const g = await gql(url, q);
    note('Palpite ' + host, q + ' → ' + JSON.stringify(g.errors ? g.errors.map(e => e.message) : g.data || g).slice(0, 500));
  }
}
