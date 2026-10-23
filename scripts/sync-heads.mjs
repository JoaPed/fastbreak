// Fotos dos jogadores guardadas no próprio site (docs/heads/<id da ESPN>.png): a imagem do lineup que se partilha
// é desenhada no browser, e o browser só deixa pôr numa imagem nova fotos do mesmo site. Descarrega as que faltam.
import fs from 'node:fs';
import path from 'node:path';
import { supa, must, pool } from './lib.mjs';

const DIR = path.join(process.cwd(), 'docs', 'heads');
const URL_OF = id => 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/' + encodeURIComponent(id) + '.png&w=200&h=146';
const MAX = +(process.env.HEADS_MAX || 700);

fs.mkdirSync(DIR, { recursive: true });
const sb = await supa();
const rows = [];
for (let from = 0; ; from += 1000) {
  const part = await must(sb.from('nba_players').select('id,avg').range(from, from + 999));
  rows.push(...part); if (part.length < 1000) break;
}
const ids = [...new Set(rows.map(r => r.avg && r.avg.espn).filter(Boolean).map(String))];
const want = ids.filter(id => /^\d+$/.test(id) && !fs.existsSync(path.join(DIR, id + '.png'))).slice(0, MAX);
let ok = 0, miss = 0;
await pool(want, 8, async id => {
  try {
    const r = await fetch(URL_OF(id));
    const ct = r.headers.get('content-type') || '';
    if (!r.ok || !/image/.test(ct)) { miss++; return; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 500) { miss++; return; }
    fs.writeFileSync(path.join(DIR, id + '.png'), buf); ok++;
  } catch (e) { miss++; }
});
console.log('Fotos: ' + ids.length + ' jogadores com foto na ESPN · ' + ok + ' novas' + (miss ? ' · ' + miss + ' sem resposta' : '') + (want.length < ids.filter(id => !fs.existsSync(path.join(DIR, id + '.png'))).length ? ' (mais amanhã)' : ''));
console.log('::notice::Fotos guardadas: ' + ok + ' novas');
