// Sonda temporária (ramo sonda-locks): o contrato TopShotLocking está em 0x0b2a3299cc857e29? Quantos Moments trancados?
import { flowScript } from './lib.mjs';
const note = (t, m) => console.log('::notice title=' + t + '::' + String(m).replace(/\n/g, ' ').slice(0, 3000));
const S1 = `import TopShotLocking from 0x0b2a3299cc857e29
access(all) fun main(): Int { return TopShotLocking.getLockedNFTsLength() }`;
const S2 = `import TopShotLocking from 0x0b2a3299cc857e29
access(all) fun main(ids: [UInt64]): [UFix64?] { let o: [UFix64?] = []; for i in ids { o.append(TopShotLocking.getExpiry(tokenID: i)) }; return o }`;
try { note('Locking', 'trancados: ' + await flowScript(S1, [])); } catch (e) { note('Locking erro', e.message); }
try { note('Expiry', JSON.stringify(await flowScript(S2, [{ type: 'Array', value: ['1', '2', '3', '12345678'].map(v => ({ type: 'UInt64', value: v })) }]))); } catch (e) { note('Expiry erro', e.message); }
