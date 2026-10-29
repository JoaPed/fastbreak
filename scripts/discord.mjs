// Discord → Telegram: lê as mensagens novas dos canais do servidor do grupo no Discord (onde se seguem os canais de
// anúncios do Top Shot, com o "Seguir" do Discord) e manda-as para o grupo do Telegram. Guarda as últimas em
// job_state 'discord'. Corre de 15 em 15 min (discord.yml). Só fetch (Node 20), sem instalar nada.
// Segredos: DISCORD_BOT_TOKEN (bot do Discord com "Message Content Intent" ligado, convidado para o servidor do
// grupo com Ver canais + Ler histórico); opcional DISCORD_CHANNEL_IDS (ids separados por vírgulas; sem ele lê todos
// os canais de texto que o bot vê). TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID (ou o grupo guardado em job_state).

import { readFileSync } from 'node:fs';
const DC = (process.env.DISCORD_BOT_TOKEN || '').trim();
const TEST = process.env.DISCORD_TEST === 'true';
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), KEY = process.env.SUPABASE_SERVICE_KEY || '';
const TG = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const KEEP = 60; // mensagens guardadas em job_state
let FILTER = {};
try { FILTER = JSON.parse(readFileSync(new URL('./discord-filter.json', import.meta.url), 'utf8')); } catch (e) { console.log('::warning::sem scripts/discord-filter.json: não vai nada para o Telegram'); FILTER = { canais: ['(nenhum)'] }; }

// texto de uma mensagem: o conteúdo e, se vier de um canal seguido, os embeds (título, descrição, campos)
export function msgText(m) {
  const parts = [];
  if (m.content) parts.push(m.content);
  for (const e of m.embeds || []) {
    if (e.title) parts.push(e.title);
    if (e.description) parts.push(e.description);
    for (const f of e.fields || []) parts.push((f.name ? f.name + ': ' : '') + (f.value || ''));
  }
  for (const a of m.attachments || []) if (a.url) parts.push(a.url);
  return parts.join('\n').trim();
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// mensagem para o Telegram (HTML): de onde vem e o texto, cortado para caber
export function tgText(m, chName) {
  const who = (m.author && (m.author.global_name || m.author.username)) || '';
  const head = '📣 <b>Discord</b> · #' + esc(chName || '?') + (who ? ' · ' + esc(who) : '');
  const body = msgText(m); const max = 3500;
  return head + '\n\n' + esc(body.length > max ? body.slice(0, max) + '…' : body);
}
// filtro (scripts/discord-filter.json): canais e palavras que passam para o Telegram
export function passes(m, ch, f) {
  const cs = (f && f.canais) || [], ws = ((f && f.palavras) || []).map(w => String(w).toLowerCase()).filter(Boolean);
  if (cs.length && !cs.some(c => String(c) === String(ch.id) || String(c).replace(/^#/, '').toLowerCase() === String(ch.name || '').toLowerCase())) return false;
  const t = msgText(m).toLowerCase();
  return !ws.length || ws.some(w => t.includes(w));
}
export const isFollowed = m => ((+m.flags || 0) & 2) === 2;
// ids do Discord crescem com o tempo: compara-os como números grandes
export const newer = (a, b) => (BigInt(a) > BigInt(b));

export async function main() {
  if (!DC) { console.log('Sem DISCORD_BOT_TOKEN: nada a fazer.'); return; }
  if (!URL_ || !KEY) { console.log('Sem SUPABASE_URL / SUPABASE_SERVICE_KEY'); return; }
  const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
  const getState = async (k, def) => { const r = await fetch(URL_ + '/rest/v1/job_state?key=eq.' + k + '&select=value', { headers: H }); if (!r.ok) throw new Error('job_state ' + r.status); const rows = await r.json(); return (rows[0] && rows[0].value) || def; };
  const setState = async (k, value) => { const r = await fetch(URL_ + '/rest/v1/job_state?on_conflict=key', { method: 'POST', headers: Object.assign({ Prefer: 'resolution=merge-duplicates' }, H), body: JSON.stringify([{ key: k, value, updated_at: new Date().toISOString() }]) }); if (!r.ok) throw new Error('job_state ' + r.status); };
  const dc = async path => {
    for (let i = 0; i < 3; i++) {
      const r = await fetch('https://discord.com/api/v10' + path, { headers: { Authorization: 'Bot ' + DC, 'User-Agent': 'DiscordBot (https://github.com/JoaPed/fastbreak, 1)' } });
      if (r.status === 429) { const j = await r.json().catch(() => ({})); await new Promise(ok => setTimeout(ok, Math.ceil((+j.retry_after || 1) * 1000))); continue; }
      if (!r.ok) throw new Error('Discord ' + path.split('?')[0] + ' ' + r.status);
      return r.json();
    }
    throw new Error('Discord: demasiados pedidos');
  };
  // canais: os indicados, ou todos os de texto/anúncios dos servidores onde está o bot
  let chans = [];
  const ids = (process.env.DISCORD_CHANNEL_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length) chans = await Promise.all(ids.map(id => dc('/channels/' + id).catch(e => { console.log('::warning::' + e.message); return null; })));
  else for (const g of await dc('/users/@me/guilds')) chans = chans.concat((await dc('/guilds/' + g.id + '/channels')).filter(c => c.type === 0 || c.type === 5));
  chans = chans.filter(Boolean);
  if (!chans.length) { console.log('::notice title=Discord::o bot não vê nenhum canal (convida-o para o servidor do grupo)'); return; }
  const st = await getState('discord', { last: {}, msgs: [] }), first = !Object.keys(st.last || {}).length;
  st.last = st.last || {}; st.msgs = st.msgs || [];
  const fresh = [], tests = [];
  for (const c of chans) {
    let list;
    try { list = await dc('/channels/' + c.id + '/messages?limit=50' + (st.last[c.id] ? '&after=' + st.last[c.id] : '')); }
    catch (e) { console.log('::warning::#' + c.name + ': ' + e.message + ' (o bot precisa de Ver canal e Ler histórico)'); continue; }
    list = list.sort((a, b) => (newer(a.id, b.id) ? 1 : -1));
    if (list.length) st.last[c.id] = list[list.length - 1].id; // avança também por cima das sem texto
    else if (!st.last[c.id]) st.last[c.id] = '0';
    // só o que chega dos canais seguidos (anúncios do Top Shot, marca IS_CROSSPOST): a conversa do servidor não é lida
    list = list.filter(m => isFollowed(m) && msgText(m));
    list.forEach(m => fresh.push({ m, ch: c.name, ok: passes(m, c, FILTER) }));
    // ensaio (correr a tarefa à mão com "teste"): manda também a última mensagem escrita no servidor que comece por
    // !teste, da última hora (não fica guardada)
    if (TEST) {
      const recent = await dc('/channels/' + c.id + '/messages?limit=30').catch(() => []);
      const t = recent.filter(m => /^!teste\b/i.test(m.content || '') && Date.now() - Date.parse(m.timestamp) < 3600e3).sort((a, b) => (newer(a.id, b.id) ? 1 : -1)).pop();
      if (t) tests.push({ m: t, ch: c.name });
    }
  }
  fresh.sort((a, b) => (newer(a.m.id, b.m.id) ? 1 : -1));
  st.msgs = st.msgs.concat(fresh.map(({ m, ch, ok }) => ({ id: m.id, ch, tg: ok, at: m.timestamp, who: (m.author && (m.author.global_name || m.author.username)) || '', text: msgText(m).slice(0, 4000) }))).slice(-KEEP);
  // a primeira vez só marca onde vai (não despeja o histórico todo no Telegram)
  let sent = 0;
  const out = (first ? [] : fresh.filter(x => x.ok).slice(-10)).concat(tests);
  if (tests.length) console.log('::notice title=Discord::ensaio: ' + tests.length + ' mensagem !teste');
  if (out.length && TG) {
    const chat = (process.env.TELEGRAM_CHAT_ID || '').trim() || ((await getState('telegram', {})) || {}).chat;
    if (!chat) console.log('::notice title=Discord::ainda não sei o grupo do Telegram (corre a tarefa das lesões)');
    else for (const { m, ch } of out) {
      const r = await fetch('https://api.telegram.org/bot' + TG + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text: tgText(m, ch), parse_mode: 'HTML', disable_web_page_preview: true }) }).then(x => x.json()).catch(e => ({ ok: false, description: e.message }));
      if (r.ok) sent++; else console.log('::warning::Telegram: ' + String(r.description || '').slice(0, 120));
    }
  }
  st.at = new Date().toISOString(); st.chans = chans.map(c => ({ id: c.id, name: c.name }));
  await setState('discord', st);
  console.log('::notice title=Discord::' + chans.length + ' canais · ' + fresh.length + ' mensagens novas (' + fresh.filter(x => x.ok).length + ' passam o filtro)' + (first ? ' (1.ª vez: só marca o ponto de partida)' : ' · ' + sent + ' no Telegram'));
}

if (import.meta.url === 'file://' + process.argv[1]) await main();
