// Sonda (manual): onde está o Fast Break desta época? Contratos da conta do Top Shot, NFTs do Fast Break na
// blockchain e o último dia de cada conta. Resultado nas notas da tarefa.
import { flowScript, cadence } from './lib.mjs';
const note = (t, m) => console.log('::notice title=' + t + '::' + String(m).replace(/\n/g, ' ').slice(0, 3800));
const ADDRS = (process.argv[2] || '').split(',').filter(Boolean);
try {
  const r = await fetch('https://rest-mainnet.onflow.org/v1/accounts/0x0b2a3299cc857e29?expand=contracts');
  const js = await r.json();
  note('Contratos do Top Shot', Object.keys(js.contracts || {}).join(', '));
} catch (e) { note('Contratos do Top Shot', 'erro ' + e.message); }
try {
  const s = await flowScript(`import FastBreakV1 from 0x0b2a3299cc857e29
access(all) fun main(): [UInt64] { return [FastBreakV1.totalSupply, FastBreakV1.nextPlayerId] }`, []);
  note('FastBreakV1', 'NFTs já criados: ' + s[0] + ' · jogadores: ' + s[1]);
} catch (e) { note('FastBreakV1', 'erro ' + e.message.slice(0, 300)); }
for (const a of ADDRS) {
  try {
    const s = await flowScript(`import FastBreakV1 from 0x0b2a3299cc857e29
access(all) fun main(addr: Address): [String] {
  let col = getAccount(addr).capabilities.borrow<&{FastBreakV1.FastBreakNFTCollectionPublic}>(FastBreakV1.CollectionPublicPath)
  if col == nil { return ["sem coleção"] }
  var last: UInt64 = 0
  var name = ""
  var run = ""
  for id in col!.getIDs() {
    if let nft = col!.borrowFastBreakNFT(id: id) {
      if let g = FastBreakV1.getFastBreakGame(id: nft.fastBreakGameID) {
        if g.submissionDeadline > last { last = g.submissionDeadline; name = g.name; run = g.fastBreakRunID }
      }
    }
  }
  return [col!.getIDs().length.toString(), last.toString(), name, run]
}`, [cadence.address(a)]);
    note('Conta ' + a, 'NFTs: ' + s[0] + ' · último dia: ' + (s[1] ? new Date(+s[1] * 1000).toISOString() : '-') + ' ' + (s[2] || '') + ' · run ' + (s[3] || ''));
  } catch (e) { note('Conta ' + a, 'erro ' + e.message.slice(0, 300)); }
}
