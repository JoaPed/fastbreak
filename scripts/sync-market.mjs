// Mercado do Top Shot (blockchain Flow, sem sessão nem browser) → preços de cada Moment.
// As vendas do mercado da Dapper passam pelo NFTStorefrontV2: ListingAvailable (posto à venda, com o preço pedido)
// e ListingCompleted (vendido, ou tirado da venda). Para cada Moment do Top Shot lê-se, da carteira de quem o tem,
// o jogador, o set, a série e o escalão. Fica em market_asks (à venda agora, os que a tarefa viu entrar) e em
// market_sales (vendas). O site mostra, por jogador e escalão, o preço mais baixo à venda e as últimas vendas.
// Continua de onde ficou (job_state 'market'); na primeira vez lê MARKET_BACKFILL blocos para trás (~1 bloco/s).
// Uso: node scripts/sync-market.mjs
import { supa, must, getState, setState, flowEvents, flowLatestHeight, flowScript, cadence, playerKey, pool, upsertChunks, momentTierOf, MOMENT_TIERS as TIERS, TIER_SETS } from './lib.mjs';

const sb = globalThis.__FB_TEST_SB || await supa(); // (nos testes: base de dados falsa)
const TS_NFT = 'A.0b2a3299cc857e29.TopShot.NFT';
const T_AV = 'A.4eb8a10cb9f87357.NFTStorefrontV2.ListingAvailable';
const T_CO = 'A.4eb8a10cb9f87357.NFTStorefrontV2.ListingCompleted';
const T_DEP = 'A.0b2a3299cc857e29.TopShot.Deposit';
const CHUNK = 250, MAX = +(process.env.MARKET_MAX_BLOCKS || 60000), BACKFILL = +(process.env.MARKET_BACKFILL || 1200000); // ~14 dias: os anúncios mais antigos só entram quando mudam ou se vendem
const note = m => console.log('::notice title=Mercado::' + String(m).slice(0, 3000));

// Moments de uma carteira: [jogador, set, série, id, setID, playID, escalão (metadados), subedição, número]
const META_SCRIPT = `import TopShot from 0x0b2a3299cc857e29
access(all) fun main(addr: Address, ids: [UInt64]): [[String]] {
  let out: [[String]] = []
  if let col = getAccount(addr).capabilities.borrow<&{TopShot.MomentCollectionPublic}>(/public/MomentCollection) {
    for id in ids {
      if let m = col.borrowMoment(id: id) {
        let series: UInt32 = TopShot.getSetSeries(setID: m.data.setID) ?? 0
        let sub = TopShot.getSubeditionByNFTID(id)
        out.append([TopShot.getPlayMetaDataByField(playID: m.data.playID, field: "FullName") ?? "", TopShot.getSetName(setID: m.data.setID) ?? "", series.toString(), id.toString(), m.data.setID.toString(), m.data.playID.toString(), TopShot.getPlayMetaDataByField(playID: m.data.playID, field: "Tier") ?? "", sub?.name ?? "", m.data.serialNumber.toString()])
      }
    }
  }
  return out
}`;
const EDITIONS_SCRIPT = `import TopShot from 0x0b2a3299cc857e29
access(all) fun main(sets: [UInt32]): {UInt32: {UInt32: UInt32}} {
  let out: {UInt32: {UInt32: UInt32}} = {}
  for s in sets { if let d = TopShot.getSetData(setID: s) { out[s] = d.getNumberMintedPerPlay() } }
  return out
}`;
// sem as tabelas (falta correr o SQL do mercado no Supabase): avisa e sai sem erro
{ const { error } = await sb.from('market_asks').select('listing_id').limit(1); if (error) { note('falta criar as tabelas do mercado no Supabase (SQL em supabase/schema.sql): ' + String(error.message).slice(0, 120)); process.exit(0); } }
const state = await getState(sb, 'market', {});
const top = await flowLatestHeight();
const from = state.height ? state.height + 1 : Math.max(1, top - BACKFILL);
const to = Math.min(top, from + MAX - 1);
if (from > to) { console.log('Mercado em dia.'); process.exit(0); }

async function events(type) {
  const spans = []; for (let h = from; h <= to; h += CHUNK) spans.push([h, Math.min(to, h + CHUNK - 1)]);
  const out = []; let err = 0;
  await pool(spans, 6, async ([a, b]) => {
    for (let i = 0; i < 3; i++) {
      try { out.push(...await flowEvents(type, a, b)); return; }
      catch (e) { if (i === 2) { err++; if (err < 3) console.log('Erro a ler', type.split('.').pop(), a, String(e.message).slice(0, 150)); } else await new Promise(r => setTimeout(r, 800)); }
    }
  });
  if (err) throw new Error(err + ' blocos de ' + type.split('.').pop() + ' por ler: tenta outra vez');
  return out;
}
const [av, co, dep] = [await events(T_AV), await events(T_CO), await events(T_DEP)];
const isTS = e => String(e.data.nftType || '').includes('TopShot.NFT');
const asks = av.filter(isTS), done = co.filter(isTS);
// quem recebeu cada Moment (para ler os metadados das vendas): Deposit no mesmo bloco ou logo a seguir
const depBy = new Map(); dep.forEach(e => { const k = String(e.data.id); (depBy.get(k) || depBy.set(k, []).get(k)).push({ to: e.data.to, h: e.height }); });
const buyerOf = (id, h) => ((depBy.get(String(id)) || []).filter(d => d.h >= h).sort((a, b) => a.h - b.h)[0] || {}).to || null;

// metadados: dos anúncios já guardados e, os que faltam, da carteira de quem tem o Moment
const known = new Map();
const lids = done.map(e => String(e.data.listingResourceID));
for (let i = 0; i < lids.length; i += 200) (await must(sb.from('market_asks').select('*').in('listing_id', lids.slice(i, i + 200)))).forEach(r => known.set(r.listing_id, r));
const want = new Map(); // carteira → ids
const ask = (addr, id) => { if (!addr) return; const s = want.get(addr) || want.set(addr, new Set()).get(addr); s.add(String(id)); };
asks.forEach(e => ask(e.data.storefrontAddress, e.data.nftID));
done.forEach(e => { if (e.data.purchased && !known.has(String(e.data.listingResourceID))) ask(buyerOf(e.data.nftID, e.height), e.data.nftID); });
const meta = new Map(); let metaErr = 0;
await pool([...want.entries()], 6, async ([addr, ids]) => {
  const list = [...ids];
  for (let i = 0; i < list.length; i += 100) {
    try { (await flowScript(META_SCRIPT, [cadence.address(addr), cadence.uint64s(list.slice(i, i + 100))]) || []).forEach(r => meta.set(r[3], r)); }
    catch (e) { if (++metaErr < 3) console.log('Erro a ler a carteira', addr, String(e.message).slice(0, 150)); }
  }
});
// tiragem das edições (para o escalão quando os metadados não dizem), guardada para não voltar a ler
const minted = Object.assign({}, await getState(sb, 'market_minted', {}));
const needSets = [...new Set([...meta.values()].filter(r => !tierKnown(r) && !minted[r[4]]).map(r => r[4]))];
function tierKnown(r) { return TIERS.some(x => (String(r[6]) + ' ' + String(r[7])).toLowerCase().includes(x.toLowerCase())) || TIER_SETS[String(r[1]).toLowerCase().trim()] || /\/\s*\d+/.test(r[7] || ''); }
for (let i = 0; i < needSets.length; i += 10) {
  try { Object.assign(minted, await flowScript(EDITIONS_SCRIPT, [{ type: 'Array', value: needSets.slice(i, i + 10).map(s => ({ type: 'UInt32', value: String(s) })) }]) || {}); }
  catch (e) { console.log('Erro a ler tiragens', String(e.message).slice(0, 150)); }
}
if (needSets.length) await setState(sb, 'market_minted', minted);
const row = r => r && { player: r[0], player_id: playerKey(r[0]), set_id: +r[4], play_id: +r[5], set_name: r[1] + (r[7] && r[7] !== 'Standard' ? ' · ' + r[7] : ''), series: +r[2], serial: +r[8], tier: momentTierOf(r[6], r[7], r[1], ((minted[r[4]] || {})[r[5]])), minted: +((minted[r[4]] || {})[r[5]]) || null };
const iso = e => new Date(e.time).toISOString();

// à venda: anúncios novos; os que acabaram (vendidos ou tirados) deixam de estar ativos
const askRows = asks.map(e => { const m = row(meta.get(String(e.data.nftID))); return m && m.player ? Object.assign({ listing_id: String(e.data.listingResourceID), nft_id: +e.data.nftID, price: +e.data.salePrice, seller: e.data.storefrontAddress, listed_at: iso(e), active: true }, m) : null; }).filter(Boolean);
const closed = new Set(lids);
askRows.forEach(r => { if (closed.has(r.listing_id)) r.active = false; });
await upsertChunks(sb, 'market_asks', askRows, 'listing_id');
for (let i = 0; i < lids.length; i += 200) await must(sb.from('market_asks').update({ active: false }).in('listing_id', lids.slice(i, i + 200)));
// vendas
const saleRows = done.filter(e => e.data.purchased).map(e => {
  const lid = String(e.data.listingResourceID), k = known.get(lid) || askRows.find(r => r.listing_id === lid);
  const m = k ? { player: k.player, player_id: k.player_id, set_id: k.set_id, play_id: k.play_id, set_name: k.set_name, series: k.series, serial: k.serial, tier: k.tier, minted: k.minted } : row(meta.get(String(e.data.nftID)));
  return m && m.player ? Object.assign({ listing_id: lid, nft_id: +e.data.nftID, price: +e.data.salePrice, sold_at: iso(e) }, m) : null;
}).filter(Boolean);
await upsertChunks(sb, 'market_sales', saleRows, 'listing_id');
// limpeza: vendas com mais de 60 dias, anúncios fechados com mais de 7
await must(sb.from('market_sales').delete().lt('sold_at', new Date(Date.now() - 60 * 86400e3).toISOString()));
await must(sb.from('market_asks').delete().eq('active', false).lt('listed_at', new Date(Date.now() - 7 * 86400e3).toISOString()));
await setState(sb, 'market', { height: to, at: new Date().toISOString() });
const behind = top - to;
note('blocos ' + from + '–' + to + ' · ' + asks.length + ' postos à venda (' + askRows.length + ' guardados) · ' + done.filter(e => e.data.purchased).length + ' vendidos (' + saleRows.length + ' guardados) · ' + done.filter(e => !e.data.purchased).length + ' tirados' + (behind > 0 ? ' · faltam ' + behind + ' blocos' : ' · em dia'));
if (process.env.LOOP_FILE) (await import('node:fs')).writeFileSync(process.env.LOOP_FILE, behind > 0 ? '1' : '0');
