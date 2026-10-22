// Sonda (manual): as vendas do mercado do Top Shot estão na blockchain, com preço? Últimos ~2500 blocos.
import { flowEvents, flowLatestHeight, flowScript, cadence } from './lib.mjs';
const note = (t, m) => console.log('::notice title=' + t + '::' + String(m).replace(/\n/g, ' ').slice(0, 3800));
const top = await flowLatestHeight();
const TYPES = ['A.c1e4f4f4c4257510.TopShotMarketV3.MomentPurchased', 'A.c1e4f4f4c4257510.TopShotMarketV3.MomentListed', 'A.4eb8a10cb9f87357.NFTStorefrontV2.ListingCompleted', 'A.4eb8a10cb9f87357.NFTStorefront.ListingCompleted', 'A.0b2a3299cc857e29.TopShot.Withdraw', 'A.0b2a3299cc857e29.TopShot.Deposit'];
for (const t of TYPES) {
  const evs = [];
  try { for (let h = top - 2500; h < top; h += 250) evs.push(...await flowEvents(t, h, Math.min(top, h + 249))); }
  catch (e) { note('Vendas ' + t.split('.').slice(2).join('.'), 'erro ' + e.message.slice(0, 200)); continue; }
  const sample = evs.filter(e => t.includes('Storefront') ? /TopShot/.test(JSON.stringify(e.data)) : true).slice(0, 3);
  note('Vendas ' + t.split('.').slice(2).join('.'), evs.length + ' eventos em 2500 blocos' + (t.includes('Storefront') ? ' (' + evs.filter(e => /TopShot/.test(JSON.stringify(e.data))).length + ' do Top Shot)' : '') + ' · exemplo: ' + JSON.stringify(sample.map(e => e.data)).slice(0, 1500));
}
