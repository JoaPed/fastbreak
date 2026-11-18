// Sonda dos packs (FB). Cola na consola do browser numa página do nbatopshot.com (de preferência a dos packs).
// Só usa a API pública do Top Shot (sem a tua sessão) e só lê. No fim mostra um texto para copires e mandares.
(async () => {
  const APIP = 'https://api.production.atlas.dapperlabs.com/public/atlas.v1.';
  const out = { at: new Date().toISOString(), page: location.pathname, methods: [], calls: {}, edition: null };
  const PRIV = /email|address|username|wallet|owner|flowAddress|userId|dapperId/i; // valores destes campos não saem
  const shape = (o, d = 0, path = '', acc = {}) => {
    if (o == null || d > 5) return acc;
    if (Array.isArray(o)) { acc[path + '[]'] = 'lista(' + o.length + ')'; if (o.length) shape(o[0], d + 1, path + '[0]', acc); return acc; }
    if (typeof o === 'object') { for (const [k, v] of Object.entries(o)) shape(v, d + 1, path ? path + '.' + k : k, acc); return acc; }
    acc[path] = PRIV.test(path) ? '(' + typeof o + ')' : String(o).slice(0, 60);
    return acc;
  };
  const post = async (m, body) => {
    try {
      const r = await fetch(APIP + m, { method: 'POST', headers: { 'content-type': 'application/json', 'connect-protocol-version': '1' }, body: JSON.stringify(body) });
      const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
      return { status: r.status, body, shape: j ? Object.fromEntries(Object.entries(shape(j)).slice(0, 120)) : t.slice(0, 200) };
    } catch (e) { return { status: 'erro', body, err: String(e).slice(0, 120) }; }
  };
  // 1) que métodos a própria página conhece (lidos dos ficheiros .js que ela carregou)
  const urls = [...new Set([...document.scripts].map(s => s.src).concat(performance.getEntriesByType('resource').map(e => e.name)).filter(u => /\.js(\?|$)/.test(u)))];
  const found = new Set();
  for (const u of urls) {
    try { const t = await (await fetch(u)).text(); for (const m of t.matchAll(/atlas\.v1\.([A-Za-z]+Service)\/([A-Za-z]+)/g)) found.add(m[1] + '/' + m[2]); for (const m of t.matchAll(/"(atlas\.v1\.[A-Za-z]+Service)"[^]{0,400}?name:"([A-Za-z]+)"/g)) found.add(m[1].replace('atlas.v1.', '') + '/' + m[2]); } catch (e) {}
  }
  out.methods = [...found].sort();
  out.scripts = urls.length;
  // 2) os métodos de packs, drops, mercado e circulação: chama-os (só leitura) com pedidos simples
  const want = out.methods.filter(m => /pack|drop|circulat|supply|listing/i.test(m) && /\/(Get|List|Search|Query|Find)/.test(m)).slice(0, 25);
  if (!want.length) want.push('PackService/ListPacks', 'PackService/SearchPacks', 'PackService/GetPacks', 'DropService/ListDrops', 'DropService/GetDrops', 'MarketplaceService/SearchPackListings');
  for (const m of want) {
    let r = await post(m, { product: 'nba', limit: '3', offset: '0' });
    if (r.status !== 200) r = await post(m, { product: 'nba' });
    if (r.status !== 200) r = await post(m, {});
    out.calls[m] = r;
  }
  // 3) todos os campos de uma edição (para ver a circulação: quantos há, em packs, queimados…)
  const ed = await post('EditionService/SearchEditions', { product: 'nba', limit: '1', offset: '0', playerId: ['1629029'], tier: ['RARE'] });
  out.edition = ed;
  const txt = JSON.stringify(out);
  console.log('SONDA PACKS', out);
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483647;inset:auto 10px 10px 10px;max-width:520px;margin:0 auto;background:#111;color:#eee;font:14px system-ui;padding:12px;border:2px solid #f80;border-radius:10px';
  box.innerHTML = '<b style="color:#f80">Sonda dos packs</b> · ' + out.methods.length + ' métodos, ' + Object.keys(out.calls).length + ' chamadas<br><textarea style="width:100%;height:140px;margin-top:8px;font:11px monospace"></textarea><button style="margin-top:6px;padding:6px 12px">Copiar</button> <button style="margin-top:6px;padding:6px 12px">Fechar</button>';
  document.body.appendChild(box);
  box.querySelector('textarea').value = txt;
  const [cp, cl] = box.querySelectorAll('button');
  cp.onclick = async () => { try { await navigator.clipboard.writeText(txt); cp.textContent = 'Copiado ✓'; } catch (e) { box.querySelector('textarea').select(); cp.textContent = 'Seleciona e copia (Ctrl+C)'; } };
  cl.onclick = () => box.remove();
})();
