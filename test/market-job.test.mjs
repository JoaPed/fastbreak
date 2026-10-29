// Tarefa "Mercado": anúncios e vendas do mercado do Top Shot (NFTStorefrontV2) → market_asks e market_sales, com
// base de dados e blockchain falsas (test/helpers/job-preload.mjs).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { momentTierOf } from '../scripts/lib.mjs';
let fails = 0;
const ok = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'ok   ' : 'FALHA') + ' ' + label + (cond ? '' : ' → ' + JSON.stringify(info))); };
const root = new URL('..', import.meta.url).pathname;
const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fb-mercado-')), 'db.json');
const SELLER = '0x00000000000000aa', BUYER = '0x00000000000000bb', TS = 'A.0b2a3299cc857e29.TopShot.NFT';
const row = (name, set, id, setID, playID, tier, sub, serial) => [name, set, '8', String(id), String(setID), String(playID), tier, sub, String(serial)];
fs.writeFileSync(file, JSON.stringify({
  flow: {
    height: 1000,
    events: [
      // Jokić Common à venda (101) e Rare à venda (102); um Moment de outra coleção (ignorado)
      { height: 900, type: 'ListingAvailable', data: { storefrontAddress: SELLER, listingResourceID: 'L1', nftType: TS, nftID: 101, salePrice: 2.5 } },
      { height: 901, type: 'ListingAvailable', data: { storefrontAddress: SELLER, listingResourceID: 'L2', nftType: TS, nftID: 102, salePrice: 90 } },
      { height: 902, type: 'ListingAvailable', data: { storefrontAddress: SELLER, listingResourceID: 'LX', nftType: 'A.e4cf4bdc1751c65d.AllDay.NFT', nftID: 5, salePrice: 1 } },
      // o Common vende-se; um anúncio antigo (não visto) de um Curry vende-se e vai para o comprador
      { height: 950, type: 'ListingCompleted', data: { listingResourceID: 'L1', purchased: true, nftType: TS, nftID: 101, salePrice: 2.5 } },
      { height: 960, type: 'ListingCompleted', data: { listingResourceID: 'L0', purchased: true, nftType: TS, nftID: 200, salePrice: 4 } },
      { height: 960, type: 'Deposit', data: { id: 200, to: BUYER } },
      { height: 970, type: 'ListingCompleted', data: { listingResourceID: 'L9', purchased: false, nftType: TS, nftID: 300, salePrice: 7 } },
    ],
    moments: {
      [SELLER]: { 101: row('Nikola Jokić', 'Base Set', 101, 1, 11, '', 'Standard', 9001), 102: row('Nikola Jokić', 'Holo Icon', 102, 2, 12, '', 'Standard', 7) },
      [BUYER]: { 200: row('Stephen Curry', 'Metallic Gold LE', 200, 3, 13, '', 'Standard', 55) },
    },
    minted: { 1: { 11: 15000 }, 2: { 12: 49 } },
  },
  tables: { job_state: [], market_asks: [], market_sales: [] },
}));
execFileSync(process.execPath, ['--import', path.join(root, 'test/helpers/job-preload.mjs'), path.join(root, 'scripts/sync-market.mjs')], { env: Object.assign({}, process.env, { FB_TEST_DB: file, MARKET_BACKFILL: '500' }), stdio: 'pipe' });
const db = JSON.parse(fs.readFileSync(file, 'utf8')), A = db.tables.market_asks, Sx = db.tables.market_sales;
const a2 = A.find(r => r.listing_id === 'L2') || {}, a1 = A.find(r => r.listing_id === 'L1') || {};
ok('à venda: o Rare do Jokić, com jogador, escalão (pela tiragem) e número', a2.active === true && a2.player_id === 'nikola-jokic' && a2.tier === 'Legendary' && a2.serial === 7 && +a2.price === 90, a2);
// vendido: fica inativo (ou já foi apagado, se o anúncio tem mais de 7 dias: a data do teste é fixa)
ok('o anúncio vendido deixa de estar ativo; outras coleções não entram', (a1.active === false || !A.some(r => r.listing_id === 'L1')) && !A.some(r => r.listing_id === 'LX'), A);
const s1 = Sx.find(r => r.listing_id === 'L1') || {}, s0 = Sx.find(r => r.listing_id === 'L0') || {};
ok('venda de um anúncio visto: Common do Jokić a $2,50', s1.player_id === 'nikola-jokic' && s1.tier === 'Common' && +s1.price === 2.5, s1);
ok('venda de um anúncio não visto: lida da carteira de quem comprou (Rare pelo set)', s0.player_id === 'stephen-curry' && s0.tier === 'Rare' && +s0.price === 4, s0);
ok('tirado da venda não conta como venda', !Sx.some(r => r.listing_id === 'L9'), Sx);
ok('continua de onde ficou', (db.tables.job_state.find(r => r.key === 'market') || {}).value?.height === 1000, db.tables.job_state);
ok('escalão: metadados, subedição com tiragem, sets conhecidos', momentTierOf('Fandom', '', 'X', 0) === 'Fandom' && momentTierOf('', 'Gold /25', 'X', 0) === 'Legendary' && momentTierOf('', '', 'Metallic Gold LE', 0) === 'Rare');
console.log(fails ? fails + ' falha(s)' : 'mercado: tudo certo');
process.exit(fails ? 1 : 0);
