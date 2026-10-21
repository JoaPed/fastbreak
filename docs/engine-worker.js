// Motor da run noutro fio (Web Worker): os cálculos pesados (sugestões de compra, Sugestões para hoje, Mudar,
// aviso ao fixar/tirar, empréstimos) correm aqui, para o ecrã não congelar enquanto a run é refeita.
importScripts('core.js');
const slim = r => ({ wins: r.wins, losses: r.losses, playedCount: r.playedCount, prizes: r.prizes, normal: r.normal });
onmessage = e => {
  const { id, kind, args, key, form } = e.data;
  try {
    FB.setForm(form);
    let out;
    if (kind === 'buyRank') out = FB.buyRank.apply(null, args);
    else if (kind === 'planRun') { const r = FB.planRun.apply(null, args); out = { res: r.normal, total: r.normal.objective }; }
    else {
      const g = FB.planGroup.apply(null, args);
      out = { res: g.byKey[key || 'main'].normal, total: g.objective, group: { keys: g.keys, objective: g.objective, transfers: g.transfers, clashes: g.clashes, byKey: Object.fromEntries(g.keys.map(k => [k, slim(g.byKey[k])])) } };
    }
    postMessage({ id, out });
  } catch (err) { postMessage({ id, err: String((err && err.message) || err) }); }
};
