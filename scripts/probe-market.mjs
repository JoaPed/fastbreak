// Sonda (manual): os anúncios mais baratos de um jogador num escalão, verificados na blockchain (ainda à venda? fantasma?)
import { supa, must, flowScript, cadence } from './lib.mjs';
const note = (t, m) => console.log('::notice title=' + t + '::' + String(m).replace(/\n/g, ' ').slice(0, 3800));
const sb = await supa();
const [pid, tier] = (process.argv[2] || 'nikola-jokic:Rare').split(':');
const rows = await must(sb.from('market_asks').select('*').eq('player_id', pid).eq('tier', tier).eq('active', true).order('price', { ascending: true }).limit(8));
const CHECK = `import NFTStorefrontV2 from 0x4eb8a10cb9f87357
import TopShot from 0x0b2a3299cc857e29
access(all) fun main(addr: Address, lid: UInt64, nft: UInt64): [String] {
  let out: [String] = []
  let sf = getAccount(addr).capabilities.borrow<&{NFTStorefrontV2.StorefrontPublic}>(NFTStorefrontV2.StorefrontPublicPath)
  if sf == nil { return ["sem storefront"] }
  if let l = sf!.borrowListing(listingResourceID: lid) {
    let d = l.getDetails()
    out.append("listing ok, purchased=".concat(d.purchased ? "sim" : "não").concat(" price=").concat(d.salePrice.toString()).concat(" ghost=").concat(l.hasListingBecomeGhosted() ? "sim" : "não"))
  } else { out.append("listing não existe") }
  if let col = getAccount(addr).capabilities.borrow<&{TopShot.MomentCollectionPublic}>(/public/MomentCollection) {
    if let m = col.borrowMoment(id: nft) {
      let sub = TopShot.getSubeditionByNFTID(nft)
      out.append("set=".concat(TopShot.getSetName(setID: m.data.setID) ?? "?").concat(" tierMeta=").concat(TopShot.getPlayMetaDataByField(playID: m.data.playID, field: "Tier") ?? "").concat(" sub=").concat(sub?.name ?? "").concat(" serial=").concat(m.data.serialNumber.toString()))
    } else { out.append("o Moment já não está nesta carteira") }
  }
  return out
}`;
for (const r of rows) {
  let chk = '';
  try { chk = (await flowScript(CHECK, [cadence.address(r.seller), { type: 'UInt64', value: String(r.listing_id) }, { type: 'UInt64', value: String(r.nft_id) }])).join(' | '); } catch (e) { chk = 'erro ' + e.message.slice(0, 120); }
  note('Anúncio ' + pid + ' ' + tier, '$' + r.price + ' · ' + r.set_name + ' #' + r.serial + '/' + r.minted + ' · ' + r.listed_at + ' → ' + chk);
}
if (!rows.length) note('Anúncio ' + pid + ' ' + tier, 'nenhum ativo');
