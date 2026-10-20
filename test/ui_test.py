# Testa o site completo num Chromium sem ecrã, com o Supabase falso (test/fake-supabase.js).
import base64, json, pathlib, sys
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
docs = root / 'docs'
fake = (root / 'test' / 'fake-supabase.js').read_text()
fx = json.loads((root / 'test' / 'fixtures' / 'run.json').read_text())
RID = fx['app/state']['activeRun']
run, roster, odds = fx['runs/' + RID], fx['rosters/' + RID], fx['odds/' + RID]
shots = root / 'test' / 'shots'; shots.mkdir(exist_ok=True)

def seeded():
    days = []
    for i, d in enumerate(run['days']):
        games = [g[:3] + ['espn:4019%05d' % (i * 20 + j + 1)] for j, g in enumerate(d['games'])]
        days.append({'run_id': 'run-1', 'date': d['date'], 'objectives': d['objectives'], 'games': games, 'chain_game_id': None})
    # forma dos últimos jogos (alguns em alta, outros em baixa) para o separador Forma
    def with_form(i, a):
        k = 1 + ((i % 5) - 2) * 0.12
        l5 = {s: round(a[s] * k, 1) for s in ('pts', 'reb', 'ast', 'fg3', 'stl', 'blk')}; l5['min'] = 33
        games = [['2026-10-%02d' % (14 - g), 'BOS', 33, round(a['pts'] * k * (0.8 + 0.1 * g)), round(a['reb'] * k), round(a['ast'] * k), round(a['fg3'] * k), 9, 18, 6, 4, 5, 2, round(a['stl']), round(a['blk']), 1] for g in range(5)]
        return dict(a, min=34, form={'n10': 8, 'n5': 5, 'l10': l5, 'l5': l5, 'last': '2026-10-14', 'games': games})
    players = [{'id': pid, 'name': p['name'], 'team': p['team'], 'avg': with_form(i, p['avg']), 'gp': 20, 'updated_at': '2026-10-15T09:20:00Z'} for i, (pid, p) in enumerate(roster['players'].items())]
    odds_rows = [{'date': d, 'players': o['players'], 'source': 'The Odds API · 6 casas', 'updated_at': '2026-10-15T15:10:00Z'} for d, o in odds['days'].items()]
    friend_days = {run['days'][0]['date']: 'win', run['days'][1]['date']: 'win'}
    return {
        'users': [{'id': 'u-amigo', 'email': 'amigo@x.pt', 'password': 'segredo1'}, {'id': 'u-eu', 'email': 'eu@x.pt', 'password': 'segredo1', 'user_metadata': {'name': 'João'}}],
        'session': None, 'calls': [],
        'tables': {
            'members': [{'user_id': 'u-amigo', 'role': 'admin'}],
            'settings': [{'key': 'invite', 'value': {'code': 'amigos26'}}],
            'profiles': [{'user_id': 'u-amigo', 'display_name': 'Rui', 'topshot_username': 'rui_ts'}],
            'runs': [{'id': 'run-1', 'name': 'Run 1 · Classic', 'mode': 'classic', 'start_date': run['days'][0]['date'], 'end_date': run['days'][-1]['date'], 'prizes': run['prizes'], 'active': True, 'chain_run_id': 'cr1', 'fictitious': True}],
            'run_days': days, 'nba_players': players, 'odds_days': odds_rows,
            'chain_runs': [{'id': 'cr1', 'name': 'Classic - Run 1', 'run_start': 1792540800, 'run_end': 1793404800}],
            'chain_games': [], 'user_runs': [],
            'summaries': [{'user_id': 'u-amigo', 'run_id': 'run-1', 'wins': 2, 'losses': 0, 'expected': 7.4, 'prize_probs': [{'wins': 5, 'p': 0.93}, {'wins': 7, 'p': 0.6}, {'wins': 9, 'p': 0.18}], 'days': friend_days, 'next_p': 0.71}],
            'chain_results': [
                {'user_id': 'u-amigo', 'game_id': 'g1', 'chain_run_id': 'cr1', 'date': run['days'][0]['date'], 'points': 151, 'win': True, 'lineup': ['Shai Gilgeous-Alexander', 'Jalen Brunson']},
                {'user_id': 'u-eu', 'game_id': 'g1', 'chain_run_id': 'cr1', 'date': run['days'][0]['date'], 'points': 138, 'win': True, 'lineup': ['Shai Gilgeous-Alexander', 'Cade Cunningham', 'Tyrese Maxey', 'Jaylen Brown', 'Jalen Brunson']},
            ],
        },
    }

errors = []
def new_page(b, db):
    pg = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    if db is not None: pg.add_init_script('window.__FAKE_DB = ' + json.dumps(db) + ';')
    def serve(route):
        name = route.request.url.split('site.test/')[1].split('?')[0] or 'index.html'
        f = docs / name
        if name == 'config.js':
            return route.fulfill(status=200, content_type='application/javascript', body="window.FB_CONFIG={supabaseUrl:'https://teste.supabase.co',supabaseKey:'anon-teste'};")
        if not f.exists(): return route.fulfill(status=404, body='')
        ext = name.rsplit('.', 1)[-1]
        if ext == 'png': return route.fulfill(status=200, content_type='image/png', body=f.read_bytes())
        ct = {'html': 'text/html', 'js': 'application/javascript', 'css': 'text/css', 'webmanifest': 'application/manifest+json'}.get(ext, 'text/plain')
        route.fulfill(status=200, content_type=ct + '; charset=utf-8', body=f.read_text())
    pg.route('https://site.test/**', serve)
    pg.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=fake))
    pg.route('https://fonts.googleapis.com/**', lambda r: r.abort())
    pg.route('https://fonts.gstatic.com/**', lambda r: r.abort())
    box = {'game': {'gameStatus': 2, 'period': 2, 'homeTeam': {'teamTricode': 'SAC', 'players': [{'personId': 1627734, 'name': 'Domantas Sabonis', 'statistics': {'reboundsTotal': 7, 'points': 9}}]}, 'awayTeam': {'teamTricode': 'X', 'players': []}}}
    def espn(r):
        url = r.request.url
        if 'scoreboard' in url:
            evs = [{'id': '4019%05d' % k, 'status': {'type': {'state': 'in'}, 'period': 2}} for k in range(1, 400)]
            return r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps({'events': evs}))
        summ = {'boxscore': {'players': [{'team': {'abbreviation': 'SAC'}, 'statistics': [{'keys': ['minutes', 'points', 'rebounds', 'assists'], 'labels': ['MIN', 'PTS', 'REB', 'AST'], 'athletes': [{'athlete': {'displayName': 'Domantas Sabonis'}, 'stats': ['20', '9', '7', '3']}]}]}]}}
        return r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps(summ))
    pg.route('https://site.api.espn.com/**', espn)
    # blockchain Flow falsa: carteira com 450 Moments; lotes de mais de 150 dão erro de cálculo (para testar a divisão dos lotes)
    allnames = [p['name'] for p in roster['players'].values()]
    wallets = {'0xe7fb03955ade55fa': allnames[:12] + ['Sue Bird', 'Michael Jordan'], '0x0000000000000a01': allnames[12:24]}
    def cad(v): return json.dumps(base64.b64encode(json.dumps(v).encode()).decode())
    def S(x): return {'type': 'String', 'value': x}
    # set de cada Moment: Base Set (Common, /15000), Metallic Gold LE (Rare, /499) e Holo Icon (pela tiragem /49: Legendary)
    def setof(k): return ('Holo Icon', 90, 49) if k % 23 == 0 else ('Metallic Gold LE', 33, 499) if k % 7 == 0 else ('Base Set', 2, 15000)
    def row(k, names):
        nm, sid, _ = setof(k)
        return {'type': 'Array', 'value': [S(names[k % len(names)]), S(nm), S('8'), S(str(k)), S(str(sid)), S(str(k % 50)), S(''), S('')]}
    def editions(sets):
        def d(pairs): return {'type': 'Dictionary', 'value': [{'key': {'type': 'UInt32', 'value': str(a)}, 'value': b} for a, b in pairs]}
        cnt = {2: 15000, 33: 499, 90: 49}
        return d([(sid, d([(pl, {'type': 'UInt32', 'value': str(cnt.get(int(sid), 1000))}) for pl in range(50)])) for sid in sets])
    def flow(r):
        body = json.loads(r.request.post_data); code = base64.b64decode(body['script']).decode()
        args = [json.loads(base64.b64decode(a)) for a in body['arguments']]
        h = {'access-control-allow-origin': '*'}
        if 'sets: [UInt32]' in code:
            return r.fulfill(status=200, content_type='application/json', headers=h, body=cad(editions([x['value'] for x in args[0]['value']])))
        names = wallets.get(args[0]['value'], allnames[:3])
        if 'sets: [UInt32]' in code:
            return r.fulfill(status=200, content_type='application/json', headers=h, body=cad(editions([x['value'] for x in args[0]['value']])))
        if 'TopShotMarketV3' in code:
            # um Moment à venda no mercado V3 (continua na coleção: id 5) e um no mercado antigo V1 (fora da coleção)
            return r.fulfill(status=200, content_type='application/json', headers=h, body=cad({'type': 'Array', 'value': [row(5, names), {'type': 'Array', 'value': [S('Jalen Brunson'), S('Rookie Debut'), S('2'), S('999999'), S('7'), S('3'), S(''), S('')]}]}))
        if 'ids: [UInt64]' in code:
            ids = [int(x['value']) for x in args[1]['value']]
            if len(ids) > 150: return r.fulfill(status=400, content_type='application/json', headers=h, body='{"code":400,"message":"computation exceeds limit (100000)"}')
            return r.fulfill(status=200, content_type='application/json', headers=h, body=cad({'type': 'Array', 'value': [row(k, names) for k in ids]}))
        n = 450 if args[0]['value'] == '0xe7fb03955ade55fa' else 60
        return r.fulfill(status=200, content_type='application/json', headers=h, body=cad({'type': 'Array', 'value': [{'type': 'UInt64', 'value': str(k)} for k in range(1, n + 1)]}))
    pg.route('https://rest-mainnet.onflow.org/**', flow)
    return pg

def width(pg): return pg.evaluate('document.documentElement.scrollWidth')
def store(pg, expr): return pg.evaluate('JSON.stringify(' + expr + ')')

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # ---------- A: primeiro utilizador cria o grupo e a run ----------
    pg = new_page(b, None)
    pg.goto('https://site.test/'); pg.wait_for_timeout(600)
    print('A entrada:', pg.locator('#gate').inner_text().replace('\n', ' | ')[:120])
    pg.screenshot(path=str(shots / 'entrada.png'))
    pg.click('button[data-action="auth-mode"]'); pg.wait_for_timeout(100)
    pg.fill('#auName', 'João'); pg.fill('#auEmail', 'joao@x.pt'); pg.fill('#auPass', '123')
    pg.click('#auSubmit'); pg.wait_for_timeout(300)
    print('A palavra-passe curta:', pg.locator('.err').inner_text())
    pg.fill('#auName', 'João'); pg.fill('#auEmail', 'joao@x.pt'); pg.fill('#auPass', 'segredo1')
    pg.click('#auSubmit'); pg.wait_for_timeout(400)
    print('A grupo vazio:', pg.locator('#gate').inner_text().replace('\n', ' | ')[:160])
    pg.click('#joinForm button[type="submit"]'); pg.wait_for_timeout(400)
    print('A perfil (nome preenchido):', pg.input_value('#pfName'))
    pg.fill('#pfTs', 'joao_ts'); pg.click('#profForm button[type="submit"]'); pg.wait_for_timeout(700)
    print('A sem runs:', pg.locator('#tab-hoje').inner_text().replace('\n', ' | ')[:120])
    pg.click('#tab-hoje button[data-action="goto"]'); pg.wait_for_timeout(500)
    pg.fill('#invCode', 'amigos26'); pg.click('#inviteForm button'); pg.wait_for_timeout(300)
    pg.fill('#nrName', 'Run 1 · Classic'); pg.fill('#nrStart', '2026-10-20'); pg.fill('#nrDays', '11')
    pg.click('#newRunForm button'); pg.wait_for_timeout(900)
    pg.select_option('#obj-stat-0', 'pts'); pg.wait_for_timeout(200)
    pg.fill('#obj-target-0', '130'); pg.press('#obj-target-0', 'Tab'); pg.wait_for_timeout(400)
    print('A base:', store(pg, '{runs: __FAKE_DB.tables.runs.map(r=>[r.id,r.active]), dias: __FAKE_DB.tables.run_days.length, d1: __FAKE_DB.tables.run_days[0].objectives, convite: __FAKE_DB.tables.settings, membros: __FAKE_DB.tables.members, perfil: __FAKE_DB.tables.profiles}'))
    print('A largura ajustes:', width(pg))
    pg.close()

    # ---------- B: amigo entra com o código e usa o planeador ----------
    pg = new_page(b, seeded())
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(400)
    pg.fill('#joinCode', 'errado'); pg.click('#joinForm button[type="submit"]'); pg.wait_for_timeout(300)
    print('B código errado:', pg.locator('.err').inner_text())
    pg.fill('#joinCode', 'AMIGOS26'); pg.click('#joinForm button[type="submit"]'); pg.wait_for_timeout(400)
    pg.click('#profForm button[type="submit"]'); pg.wait_for_timeout(900)
    print('B hoje sem plantel:', pg.locator('#tab-hoje').inner_text().replace('\n', ' | ')[:100])
    print('B resultado da blockchain aplicado:', store(pg, '(__FAKE_DB.tables.user_runs[0]||{}).plan'))
    pg.click('#t-plantel'); pg.wait_for_timeout(300)
    pg.click('#plBody button[data-action="paste-sheet"]'); pg.wait_for_timeout(200)
    pg.fill('#pasteText', 'Jokic 2\nWembanyama 3\nShai Gilgeous-Alexander 2\nLuka 2\nBrunson 3, Cade Cunningham 3\nSabonis 4\nGobert 5; Maxey 3\nJalen Johnson 4\nDaniels 5\nMobley 4\nChet 4\nLopez 5\nAnthony Edwards 3\nMitchell 3\nCurry 2\nSengun 4\nZzzz Inventado 1')
    pg.click('button[data-action="paste-preview"]'); pg.wait_for_timeout(200)
    print('B correspondências:', ' / '.join(pg.locator('#pasteOut li').all_inner_texts())[:500])
    pg.click('button[data-action="paste-apply"]'); pg.wait_for_timeout(1200)
    print('B matriz:', pg.locator('.mx-row').count() - 1, 'linhas · largura', width(pg))
    pg.screenshot(path=str(shots / 'plantel.png'))
    pg.locator('.mx-row:not(.head)').first.click(); pg.wait_for_timeout(200)
    pg.click('#sheetPanel button[data-action="uses"][data-d="1"]'); pg.wait_for_timeout(900)
    pg.click('#sheetPanel button[data-action="close-sheet"]')

    pg.click('#t-hoje'); pg.wait_for_timeout(500)
    print('B hoje:', pg.locator('.hero').inner_text().replace('\n', ' | ')[:200])
    print('B lineup:', pg.locator('#tab-hoje .list .row').count(), 'jogadores · largura', width(pg))
    pg.screenshot(path=str(shots / 'hoje.png'))
    pg.click('#tab-hoje button[data-action="alts"]'); pg.wait_for_timeout(4000)
    print('B alternativas:', ' // '.join(x.replace('\n', ' | ')[:230] for x in pg.locator('#sheetPanel .card').all_inner_texts()))
    pg.screenshot(path=str(shots / 'alternativas.png'), full_page=True)
    before = store(pg, 'Object.values(__FAKE_DB.tables.user_runs[0].plan.locks || {})')
    pg.click('#sheetPanel button[data-action="alt-use"][data-i="0"]'); pg.wait_for_timeout(1500)
    print('B alternativa usada:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.locks'), '·', store(pg, '__FAKE_DB.tables.user_runs[0].plan.bans'), '· hoje:', pg.locator('.hero .pbig').inner_text().replace('\n', ' '))
    pg.click('#tab-hoje button[data-action="alts"]'); pg.wait_for_timeout(4000)
    if pg.locator('#sheetPanel button[data-action="alt-reset"]').count():
        pg.click('#sheetPanel button[data-action="alt-reset"]'); pg.wait_for_timeout(1200)
        print('B voltou à sugestão:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.locks'))
    else:
        pg.click('#sheetPanel button[data-action="close-sheet"]')
    pg.click('button[data-action="live-toggle"]'); pg.wait_for_timeout(400)
    pg.click('button[data-action="live-fetch"]'); pg.wait_for_timeout(800)
    pg.wait_for_function('() => { const l = (__FAKE_DB.tables.user_runs[0].plan || {}).live; return l && Object.values(l)[0] && Object.keys(Object.values(l)[0].players || {}).length; }', timeout=15000)
    print('B ao vivo:', store(pg, 'Object.values(__FAKE_DB.tables.user_runs[0].plan.live)[0].players'))
    print('B placar ao vivo:', pg.locator('.hero .bar-cap').inner_text().replace('\n', ' '))

    pg.click('#t-run'); pg.wait_for_timeout(400)
    print('B run (prémios):', pg.locator('#tab-run .run-board').inner_text().replace('\n', ' | '), '// distribuição:', pg.locator('#tab-run .dist i').count(), 'barras ·', pg.locator('#tab-run .dist-legend').inner_text().replace('\n', ' '))
    pg.screenshot(path=str(shots / 'run-premios.png'), full_page=True)
    pg.click('#tab-run button[data-action="sub"][data-sub="dias"]'); pg.wait_for_timeout(300); 
    print('B run dias:', pg.locator('#tab-run .drow').count(), '·', pg.locator('#tab-run .drow').first.inner_text().replace('\n', ' '))

    pg.click('#t-grupo'); pg.wait_for_timeout(2900)
    pg.click('button[data-action="group-refresh"]'); pg.wait_for_timeout(500)
    print('B grupo:', ' // '.join(pg.locator('.grp-row').all_inner_texts()).replace('\n', ' ')[:400])
    print('B grupo largura:', width(pg))
    pg.screenshot(path=str(shots / 'grupo.png'))
    pg.locator('.grp-row').first.click(); pg.wait_for_timeout(200)
    print('B folha amigo:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:200])
    pg.click('#sheetPanel button[data-action="close-sheet"]')

    pg.click('#t-ajustes'); pg.wait_for_timeout(400)
    # clique à velocidade humana: carregar, esperar, largar
    pg.fill('#pfTs2', '@outro_nome'); pg.fill('#pfFlow2', '0xe7fb03955ade55fa')
    box = pg.locator('#pfForm button[type="submit"]').bounding_box()
    pg.mouse.move(box['x'] + 10, box['y'] + 10); pg.mouse.down(); pg.wait_for_timeout(150); pg.mouse.up(); pg.wait_for_timeout(500)
    print('B perfil guardado (clique humano):', store(pg, '__FAKE_DB.tables.profiles.find(p=>p.user_id==="u-eu")'))
    print('B ajustes sem admin:', pg.locator('#inviteForm').count() == 0, '· secções:', pg.locator('#tab-ajustes h2').all_inner_texts())
    print('B resumo publicado:', store(pg, '__FAKE_DB.tables.summaries.find(s=>s.user_id==="u-eu")'))
    print('B plantel gravado:', store(pg, 'Object.keys(__FAKE_DB.tables.user_runs[0].roster).length'), 'jogadores')
    pg.click('#t-plantel'); pg.wait_for_timeout(300)
    pg.click('#tab-plantel button[data-action="sub"][data-sub="colecao"]'); pg.wait_for_timeout(300); 
    pg.click('#plSub button[data-action="wallet-sheet"]'); pg.wait_for_timeout(1500)
    print('B carteira:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:420])
    pg.screenshot(path=str(shots / 'carteira.png'))
    pg.click('#sheetPanel button[data-action="wallet-apply"]'); pg.wait_for_timeout(1200)
    print('B plantel depois da carteira:', store(pg, '{n: Object.keys(__FAKE_DB.tables.user_runs[0].roster).length, jokic: __FAKE_DB.tables.user_runs[0].roster["jokic"]}'))
    print('B escalões dos sets:', store(pg, '__FAKE_DB.tables.profiles.find(p => p.user_id === "u-eu").collection.sets'))
    print('B usos pelo escalão:', store(pg, 'Object.fromEntries(Object.entries(__FAKE_DB.tables.profiles.find(p => p.user_id === "u-eu").collection.players).slice(0, 4).map(([k, c]) => [k, [c.bySet, c.uses]]))'))
    pg.wait_for_timeout(300)
    tc = pg.locator('#plSub .card').filter(has_text='Escalões e usos')
    print('B cartão dos escalões:', tc.inner_text().replace('\n', ' | ')[:300] if tc.count() else 'sem cartão')
    if tc.count():
        pg.select_option('#plSub select[data-tier-set="Holo Icon"]', 'Rare'); pg.wait_for_timeout(800)
        print('B Holo Icon mudado para Rare:', store(pg, '__FAKE_DB.tables.profiles.find(p => p.user_id === "u-eu").collection.sets["Holo Icon"]'))
        pg.screenshot(path=str(shots / 'escaloes.png'), full_page=True)
    pg.click('#t-ajustes'); pg.wait_for_timeout(300)
    pg.click('#tab-ajustes button[data-action="logout"]'); pg.wait_for_timeout(300)
    print('B depois de sair:', pg.locator('#auSubmit').inner_text())

    # ---------- C: conta com uma smurf (coleções juntas, plano conjunto, transferências) ----------
    db = seeded(); T = db['tables']
    T['members'].append({'user_id': 'u-eu', 'role': 'member'})
    T['profiles'].append({'user_id': 'u-eu', 'display_name': 'João', 'topshot_username': 'gandapanasco', 'flow_address': '0xe7fb03955ade55fa', 'smurfs': [{'id': 's1', 'topshot_username': 'joao_smurf', 'flow_address': '0x0000000000000a01'}]})
    T['user_runs'] = [{'user_id': 'u-eu', 'run_id': 'run-1', 'roster': {pid: {'uses': 2, 'status': 'ok'} for pid in roster['players']}, 'plan': {}, 'updated_at': '2026-10-15T10:00:00Z'}]
    T['chain_results'].append({'user_id': 'u-eu', 'account': 's1', 'game_id': 'g1', 'chain_run_id': 'cr1', 'date': run['days'][0]['date'], 'points': 140, 'win': True, 'lineup': ['Nikola Jokić']})
    pg = new_page(b, db)
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(2500)
    print('C contas:', pg.locator('#tab-hoje .acc-seg').inner_text().replace('\n', ' | ') if pg.locator('#tab-hoje .acc-seg').count() else 'sem seletor')
    print('C a fazer (sem carteiras):', pg.locator('#tab-hoje .todo').inner_text().replace('\n', ' | ')[:300] if pg.locator('#tab-hoje .todo').count() else 'nada')
    print('C hoje (sem carteiras):', pg.locator('.hero .impact').inner_text().replace('\n', ' ')[:160], '//', ' / '.join(pg.locator('#tab-hoje .note').all_inner_texts())[:200])
    print('C resultado da smurf lido:', store(pg, '{played: __FAKE_DB.tables.user_runs[0].plan.smurfs && __FAKE_DB.tables.user_runs[0].plan.smurfs.s1.played, jokic: __FAKE_DB.tables.user_runs[0].roster.jokic}'))
    pg.click('#t-plantel'); pg.wait_for_timeout(600)
    pg.click('#tab-plantel button[data-action="sub"][data-sub="colecao"]'); pg.wait_for_timeout(300); 
    pg.click('#plSub button[data-action="wallet-sheet"]'); pg.wait_for_timeout(2500)
    print('C carteiras:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:300])
    pg.screenshot(path=str(shots / 'smurf-carteiras.png'))
    pg.click('#sheetPanel button[data-action="wallet-apply"]'); pg.wait_for_timeout(2500)
    print('C coleção guardada:', store(pg, '(() => { const c = __FAKE_DB.tables.profiles.find(p => p.user_id === "u-eu").collection; return { contas: c.accounts, jokic: c.players.jokic, sga: c.players.sga }; })()'))
    pg.screenshot(path=str(shots / 'smurf-plantel.png'), full_page=True)
    pg.click('#t-hoje'); pg.wait_for_timeout(800)
    print('C hoje:', pg.locator('.hero .impact').inner_text().replace('\n', ' ')[:200])
    print('C a fazer:', pg.locator('#tab-hoje .todo').inner_text().replace('\n', ' | ')[:400] if pg.locator('#tab-hoje .todo').count() else 'nada')
    print('C mandar hoje:', ' / '.join(pg.locator('#tab-hoje .card').nth(1).all_inner_texts()).replace('\n', ' | ')[:300])
    pg.click('#t-plantel'); pg.wait_for_timeout(300); pg.click('#tab-plantel button[data-action="sub"][data-sub="plantel"]'); pg.wait_for_timeout(300); pg.click('#t-hoje'); pg.wait_for_timeout(500)
    pg.screenshot(path=str(shots / 'smurf-hoje.png'), full_page=True)
    pg.click('#tab-hoje button[data-action="acc"][data-acc="s1"]'); pg.wait_for_timeout(500)
    print('C hoje smurf:', pg.locator('.hero').inner_text().replace('\n', ' | ')[:160], '// lineup:', ' / '.join(pg.locator('#tab-hoje .list .row .nm').all_inner_texts()))
    pg.screenshot(path=str(shots / 'smurf-hoje-s1.png'), full_page=True)
    pg.click('#tab-hoje button[data-action="alts"]'); pg.wait_for_timeout(9000)
    print('C alternativas smurf:', ' // '.join(x.replace('\n', ' | ')[:200] for x in pg.locator('#sheetPanel .card').all_inner_texts()))
    pg.click('#sheetPanel button[data-action="close-sheet"]')
    pg.click('#t-run'); pg.wait_for_timeout(500)
    print('C run prémios:', pg.locator('#tab-run .run-board').inner_text().replace('\n', ' | ')[:300])
    pg.click('#tab-run button[data-action="sub"][data-sub="contas"]'); pg.wait_for_timeout(300); 
    print('C run contas:', pg.locator('#tab-run .card').first.inner_text().replace('\n', ' | ')[:300])
    print('C run transferências:', pg.locator('#tab-run .card').last.inner_text().replace('\n', ' | ')[:300])
    pg.screenshot(path=str(shots / 'smurf-run.png'), full_page=True)
    t0 = __import__('time').time()
    pg.click('#t-plantel'); pg.wait_for_timeout(300); pg.click('#tab-plantel button[data-action="sub"][data-sub="comprar"]'); pg.wait_for_timeout(300); 
    pg.click('#plSub button[data-action="buy-mode"][data-mode="more"]'); pg.wait_for_timeout(200)
    pg.click('#plSub button[data-action="buy-run"]'); pg.wait_for_timeout(300); pg.wait_for_selector('#buyProg', state='detached', timeout=120000)
    print('C compras com smurf (%.1f s):' % (__import__('time').time() - t0), ' // '.join(x.replace('\n', ' | ')[:400] for x in pg.locator('#buyOut .card').all_inner_texts()[:2]))
    pg.screenshot(path=str(shots / 'compras-smurf.png'), full_page=True)
    pg.click('#tab-plantel button[data-action="sub"][data-sub="plantel"]'); pg.wait_for_timeout(300); 
    pg.click('#t-plantel'); pg.wait_for_timeout(500)
    pg.screenshot(path=str(shots / 'smurf-matriz.png'))
    print('C noites na outra conta (matriz):', pg.locator('#plSub .dot.other').count(), '·', pg.locator('#plSub .legend').inner_text().replace('\n', ' '))
    pg.locator('.mx-row:not(.head)').filter(has_text='Jokić').first.click(); pg.wait_for_timeout(300)
    print('C folha Jokić:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:300])
    print('C Jokić nas contas:', pg.locator('#sheetPanel .note').first.inner_text().replace('\n', ' | ') if pg.locator('#sheetPanel .note').count() else '-')
    pg.click('#sheetPanel button[data-action="uses"][data-acc="s1"][data-d="1"]'); pg.wait_for_timeout(1500)
    print('C usos da smurf mexidos:', store(pg, '__FAKE_DB.tables.user_runs[0].roster.jokic'))
    pg.click('#sheetPanel button[data-action="close-sheet"]')
    one = pg.evaluate('(() => { const col = __FAKE_DB.tables.profiles.find(p => p.user_id === "u-eu").collection.players; return Object.keys(__FAKE_DB.tables.user_runs[0].roster).find(id => !col[id]); })()')
    if one:
        pg.locator('#plSub .mx-row[data-id="' + one + '"]').click(); pg.wait_for_timeout(300)
        print('C um só Moment (' + one + '):', pg.locator('#sheetPanel .note').first.inner_text().replace('\n', ' | ')[:300] if pg.locator('#sheetPanel .note').count() else '-')
        pg.click('#sheetPanel button[data-action="close-sheet"]')
    pg.click('#t-ajustes'); pg.wait_for_timeout(400)
    pg.click('#tab-ajustes button[data-action="sm-add"]'); pg.wait_for_timeout(200)
    pg.fill('#smTs1', 'segunda'); pg.fill('#smFlow1', '0x123')
    pg.click('#pfForm button[type="submit"]'); pg.wait_for_timeout(400)
    print('C endereço inválido:', pg.locator('#toast').inner_text())
    pg.fill('#smFlow1', '0x0000000000000b02'); pg.click('#pfForm button[type="submit"]'); pg.wait_for_timeout(2500)
    print('C smurfs guardadas:', store(pg, '__FAKE_DB.tables.profiles.find(p => p.user_id === "u-eu").smurfs'))
    pg.screenshot(path=str(shots / 'smurf-ajustes.png'), full_page=True)
    print('C largura:', width(pg))
    pg.close()

    # ---------- D: admin apaga as runs de teste ----------
    db = seeded(); T = db['tables']
    T['runs'][0]['fictitious'] = False
    for k in ('teste-261015', 'teste-261016'):
        T['runs'].append({'id': k, 'name': 'Run de teste', 'mode': 'classic', 'start_date': '2026-10-15', 'end_date': '2026-10-25', 'prizes': [], 'active': False, 'fictitious': True})
        T['run_days'].append({'run_id': k, 'date': '2026-10-16', 'objectives': [{'stat': 'pts', 'target': 120}], 'games': [], 'chain_game_id': None})
    pg = new_page(b, db)
    pg.on('dialog', lambda d: d.accept())
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'amigo@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(1500)
    pg.click('#t-ajustes'); pg.wait_for_timeout(400)
    pg.click('#tab-ajustes button[data-action="sub"][data-sub="admin"]'); pg.wait_for_timeout(300)
    print('D sem botão para criar runs de teste:', pg.locator('#tab-ajustes button[data-action="test-run"]').count() == 0)
    pg.click('#tab-ajustes button[data-action="del-tests"]'); pg.wait_for_timeout(2000)
    print('D depois de apagar:', store(pg, '__FAKE_DB.tables.runs.map(r => r.id)'), '· botão:', pg.locator('#tab-ajustes button[data-action="del-tests"]').count())
    pg.close()

    # ---------- E: lesões, em que se baseia, avisos e dicas de compra (run a sério) ----------
    import datetime
    db = seeded(); T = db['tables']
    T['runs'][0]['fictitious'] = False
    T['members'].append({'user_id': 'u-eu', 'role': 'member'})
    T['profiles'].append({'user_id': 'u-eu', 'display_name': 'João', 'topshot_username': 'gandapanasco', 'flow_address': '0xe7fb03955ade55fa'})
    mine = list(roster['players'])[:16]
    T['user_runs'] = [{'user_id': 'u-eu', 'run_id': 'run-1', 'roster': {pid: {'uses': 2, 'status': 'ok'} for pid in mine}, 'plan': {}, 'updated_at': '2026-10-15T10:00:00Z'}]
    T['chain_results'] = []
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    T['injuries'] = [
        {'id': 'maxey', 'name': 'Tyrese Maxey', 'team': 'PHI', 'status': 'out', 'label': 'Out', 'detail': 'Ankle', 'comment': 'Maxey will miss Tuesday.', 'return_date': None, 'updated_at': now_iso},
        {'id': 'sga', 'name': 'Shai Gilgeous-Alexander', 'team': 'OKC', 'status': 'dtd', 'label': 'Day-To-Day', 'detail': 'Knee · Tendinitis (left)', 'comment': 'SGA is questionable.', 'return_date': None, 'updated_at': now_iso},
    ]
    pg = new_page(b, db)
    sent = []
    def ntfy(r):
        sent.append(r.request.post_data)
        r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body='{}')
    pg.route('https://ntfy.sh/**', ntfy)
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(2500)
    print('E lineup dia 1:', ' / '.join(pg.locator('#tab-hoje .card').filter(has_text='Jogo a jogo').locator('.row .nm').all_inner_texts()))
    pg.wait_for_timeout(5000)
    print('E a fazer:', pg.locator('#tab-hoje .todo').inner_text().replace('\n', ' | ')[:300] if pg.locator('#tab-hoje .todo').count() else 'nada')
    print('E quem joga hoje:', pg.locator('#tab-hoje .card').filter(has_text='Quem joga hoje').inner_text().replace('\n', ' | ')[:300])
    print('E sugestões (hoje):', pg.locator('#tab-hoje .card').filter(has_text='Sugestões de compra').inner_text().replace('\n', ' | ')[:400])
    pg.screenshot(path=str(shots / 'hoje-completo.png'), full_page=True)
    pg.click('#t-run'); pg.wait_for_timeout(500)
    print('E run prémios:', ' // '.join(x.replace('\n', ' | ')[:250] for x in pg.locator('#tab-run .card').all_inner_texts()[2:5]))
    pg.screenshot(path=str(shots / 'run-premios-2.png'), full_page=True)
    pg.click('#tab-run button[data-action="sub"][data-sub="dias"]'); pg.wait_for_timeout(300)
    print('E dias com lesão:', pg.locator('#tab-run .drow').filter(has_text='lesão').count())
    pg.click('#tab-run button[data-action="sub"][data-sub="premios"]'); pg.wait_for_timeout(300)
    btns = pg.locator('#tab-run button[data-action="buy-open"]')
    if btns.count():
        btns.first.click(); pg.wait_for_timeout(500)
        print('E abrir sugestão:', pg.locator('#plSubBar button[aria-selected="true"]').inner_text(), '·', pg.locator('#buyOut .card').count(), 'cartões')
    pg.click('#t-hoje'); pg.wait_for_timeout(400)
    print('E linhas com lesão:', ' / '.join(x.replace('\n', ' ') for x in pg.locator('#tab-hoje .row').filter(has_text='lesão').all_inner_texts())[:300])
    pg.click('#tab-hoje button[data-action="sub"][data-sub="porque"]'); pg.wait_for_timeout(300); 
    print('E em que se baseia:', pg.locator('#tab-hoje .basis-day').inner_text().replace('\n', ' | ')[:900])
    pg.screenshot(path=str(shots / 'hoje-baseia.png'), full_page=True)
    print('E próximos lineups publicados:', store(pg, 'Object.keys((__FAKE_DB.tables.user_runs[0].plan.next || {}).main || {})'))
    pg.locator('#tab-hoje .basis-day button[data-action="player"]').first.click(); pg.wait_for_timeout(300)
    print('E ficha (em que se baseia):', pg.locator('#sheetPanel .basis').inner_text().replace('\n', ' | ')[:700])
    pg.screenshot(path=str(shots / 'ficha-baseia.png'), full_page=True)
    pg.click('#sheetPanel button[data-action="close-sheet"]')
    pg.click('#tab-hoje button[data-action="sub"][data-sub="comparar"]'); pg.wait_for_timeout(300); 
    print('E comparar (hoje):', pg.locator('#tab-hoje table.cmp tbody tr').count(), 'jogadores · jogos seguidos:', pg.locator('#tab-hoje table.cmp tbody tr').filter(has_text='2.º seguido').count())
    pg.click('#tab-hoje button[data-action="cmp-sort"][data-col="l5"]'); pg.wait_for_timeout(300)
    print('E comparar ordenado:', pg.locator('#tab-hoje table.cmp thead button[aria-sort="descending"]').inner_text())
    pg.locator('#tab-hoje table.cmp tbody tr').filter(has_text='Gilgeous').click(); pg.wait_for_timeout(300)
    print('E ficha SGA (lesão):', pg.locator('#sheetPanel .note').first.inner_text().replace('\n', ' | ')[:300], '//', pg.locator('#sheetPanel .basis').inner_text().replace('\n', ' | ')[:400])
    pg.screenshot(path=str(shots / 'ficha-lesao.png'), full_page=True)
    pg.click('#sheetPanel button[data-action="close-sheet"]')
    pg.click('#tab-hoje button[data-action="sub"][data-sub="lineup"]'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(shots / 'hoje-lineup.png'), full_page=True)
    pg.click('#t-plantel'); pg.wait_for_timeout(500)
    pg.click('#tab-plantel button[data-action="sub"][data-sub="plantel"]'); pg.wait_for_timeout(300)
    pg.click('#plSub button[data-action="uses-sheet"]'); pg.wait_for_timeout(300)
    pg.fill('#usesSearch', 'james'); pg.wait_for_timeout(200)
    print('E acertar usos (james):', pg.locator('#usesList .uses-row').count(), 'linha(s) ·', pg.locator('#usesList .uses-row').first.inner_text().replace('\n', ' | '))
    pg.locator('#usesList button[data-action="uses"][data-d="1"]').first.click(); pg.wait_for_timeout(150)
    pg.locator('#usesList button[data-action="uses"][data-d="1"]').first.click(); pg.wait_for_timeout(900)
    print('E usos guardados:', store(pg, '__FAKE_DB.tables.user_runs[0].roster.lebron'), '· mostrado:', pg.locator('#usesList output').first.inner_text())
    pg.screenshot(path=str(shots / 'acertar-usos.png'))
    pg.click('#sheetPanel button[data-action="close-sheet"]')
    print('E sub-separadores do plantel:', pg.locator('#plSubBar').inner_text().replace('\n', ' | '))
    pg.click('#tab-plantel button[data-action="sub"][data-sub="lesoes"]'); pg.wait_for_timeout(300); 
    print('E lesões:', pg.locator('#plSub').inner_text().replace('\n', ' | ')[:400])
    pg.screenshot(path=str(shots / 'jogadores-lesoes.png'), full_page=True)
    pg.locator('#plSub .card').filter(has_text='No teu plantel').locator('button[data-action="pl-sheet"]').filter(has_text='Maxey').click(); pg.wait_for_timeout(300)
    print('E ficha Maxey:', pg.locator('#sheetPanel .note').first.inner_text().replace('\n', ' | ')[:300])
    pg.click('#sheetPanel button[data-action="inj-ignore"]'); pg.wait_for_timeout(1200)
    print('E ignorar relatório:', store(pg, '__FAKE_DB.tables.user_runs[0].roster.maxey'), '·', pg.locator('#sheetPanel .note').first.inner_text().replace('\n', ' | ')[:160])
    pg.click('#sheetPanel button[data-action="inj-ignore"]'); pg.wait_for_timeout(1200)
    pg.click('#sheetPanel button[data-action="close-sheet"]')
    pg.click('#tab-plantel button[data-action="sub"][data-sub="forma"]'); pg.wait_for_timeout(300); 
    print('E forma (meus):', pg.locator('#plSub').inner_text().replace('\n', ' | ')[:500])
    pg.screenshot(path=str(shots / 'jogadores-forma.png'), full_page=True)
    pg.click('#plSub button[data-action="forma-scope"][data-v="all"]'); pg.wait_for_timeout(300)
    print('E forma (NBA):', pg.locator('#plSub .frow').count(), 'linhas ·', (pg.locator('#plSub .frow').first.inner_text().replace('\n', ' | ') if pg.locator('#plSub .frow').count() else ''))
    if pg.locator('#plSub .frow').count():
        pg.locator('#plSub .frow').last.click(); pg.wait_for_timeout(300)
        print('E ficha da forma:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:200]); pg.click('#sheetPanel button[data-action="close-sheet"]')
    pg.click('#t-ajustes'); pg.wait_for_timeout(400)
    print('E ajustes sem avisos (desligados por agora):', pg.locator('#tab-ajustes h2').all_inner_texts() if pg.click('#t-ajustes') is None and pg.wait_for_timeout(400) is None else '')
    pg.click('#t-plantel'); pg.wait_for_timeout(300); pg.click('#tab-plantel button[data-action="sub"][data-sub="comprar"]'); pg.wait_for_timeout(300); 
    t0 = __import__('time').time()
    pg.click('#plSub button[data-action="buy-run"]'); pg.wait_for_timeout(300); pg.wait_for_selector('#buyProg', state='detached', timeout=90000)
    print('E compras (%.1f s):' % (__import__('time').time() - t0), ' // '.join(x.replace('\n', ' | ')[:330] for x in pg.locator('#buyOut .card').all_inner_texts()[:3]))
    pg.screenshot(path=str(shots / 'compras.png'), full_page=True)
    pg.fill('#buySearch', 'Curry'); pg.wait_for_timeout(200)
    pg.click('#buyFound button[data-action="buy-pick"]'); pg.wait_for_timeout(300); pg.wait_for_selector('#buyProg', state='detached', timeout=90000)
    print('E avaliar Curry:', pg.locator('#buyOut').inner_text().replace('\n', ' | ')[:400])
    pg.click('#plSub button[data-action="buy-mode"][data-mode="more"]'); pg.wait_for_timeout(200)
    pg.click('#plSub button[data-action="buy-run"]'); pg.wait_for_timeout(300); pg.wait_for_selector('#buyProg', state='detached', timeout=90000)
    print('E mais usos:', ' // '.join(x.replace('\n', ' | ')[:200] for x in pg.locator('#buyOut .card').all_inner_texts()[:2]))
    pg.click('#t-grupo'); pg.wait_for_timeout(600)
    print('E grupo:', ' // '.join(pg.locator('.grp-row').all_inner_texts()).replace('\n', ' ')[:300])
    pg.screenshot(path=str(shots / 'grupo-aros.png'), full_page=True)
    print('E largura:', width(pg))
    pg.close()

    # ---------- F: jogos de hoje ao vivo e jogos seguidos (relógio no dia 1, a meio do 2.º jogo) ----------
    db = seeded(); T = db['tables']
    T['runs'][0]['fictitious'] = False
    T['members'].append({'user_id': 'u-eu', 'role': 'member'})
    T['profiles'].append({'user_id': 'u-eu', 'display_name': 'João', 'topshot_username': 'gandapanasco'})
    T['user_runs'] = [{'user_id': 'u-eu', 'run_id': 'run-1', 'roster': {pid: {'uses': 2, 'status': 'ok'} for pid in list(roster['players'])[:16]}, 'plan': {}, 'updated_at': '2026-10-15T10:00:00Z'}]
    T['chain_results'] = []; T['injuries'] = []
    pg = new_page(b, db)
    pg.clock.set_fixed_time('2026-10-20T23:45:00Z')
    d0 = run['days'][0]
    def comp(away, home, a, h): return [{'competitors': [{'homeAway': 'away', 'team': {'abbreviation': away}, 'score': str(a)}, {'homeAway': 'home', 'team': {'abbreviation': home}, 'score': str(h)}]}]
    def board(r):
        url = r.request.url
        if 'scoreboard' in url and 'dates=20261019' in url:   # véspera: PHI e NYK jogaram (2.º jogo seguido no dia 1)
            evs = [{'id': '1', 'date': '2026-10-19T23:30:00Z', 'status': {'type': {'state': 'post', 'shortDetail': 'Final'}, 'period': 4}, 'competitions': comp('PHI', 'NYK', 101, 99)}]
        elif 'scoreboard' in url:
            evs = []
            for j, g in enumerate(d0['games']):
                st = 'post' if g[2] < '2026-10-20T23:00' else 'in' if g[2] < '2026-10-20T23:45' else 'pre'
                evs.append({'id': '4019%05d' % (j + 1), 'date': g[2], 'status': {'type': {'state': st, 'shortDetail': {'post': 'Final', 'in': '2nd 4:12', 'pre': ''}[st]}, 'period': 2 if st == 'in' else 4}, 'competitions': comp(g[0], g[1], 55 + j, 48 + j)})
        else:
            evs = None
        if evs is not None: return r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps({'events': evs}))
        summ = {'boxscore': {'players': [{'team': {'abbreviation': 'PHI'}, 'statistics': [{'keys': ['minutes', 'points', 'rebounds', 'assists'], 'labels': ['MIN', 'PTS', 'REB', 'AST'], 'athletes': [{'athlete': {'displayName': 'Jaylen Brown'}, 'stats': ['20', '14', '3', '2']}, {'athlete': {'displayName': 'LeBron James'}, 'stats': ['18', '11', '5', '6']}]}]}]}}
        return r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps(summ))
    pg.route('https://site.api.espn.com/**', board)
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(3000)
    card = pg.locator('#tab-hoje .card').filter(has_text='Jogos de hoje')
    print('F jogos de hoje:', card.inner_text().replace('\n', ' | ')[:400] if card.count() else 'sem cartão')
    print('F a fazer:', pg.locator('#tab-hoje .todo').inner_text().replace('\n', ' | ')[:200] if pg.locator('#tab-hoje .todo').count() else 'nada')
    print('F lineup (seguidos):', ' / '.join(x.replace('\n', ' ') for x in pg.locator('#tab-hoje .card').filter(has_text='Jogo a jogo').locator('.row').all_inner_texts()))
    pg.click('button[data-action="live-toggle"]'); pg.wait_for_timeout(2500)
    print('F ao vivo (sozinho):', store(pg, 'Object.values((__FAKE_DB.tables.user_runs[0].plan.live)||{})[0]?.players || null'))
    print('F jogos de hoje (ao vivo):', pg.locator('#tab-hoje .card').filter(has_text='Jogos de hoje').inner_text().replace('\n', ' | ')[:400])
    pg.screenshot(path=str(shots / 'ao-vivo.png'), full_page=True)
    pg.click('#tab-hoje button[data-action="sub"][data-sub="comparar"]'); pg.wait_for_timeout(400)
    print('F comparar (seguidos):', pg.locator('#tab-hoje table.cmp tbody tr').filter(has_text='2.º seguido').count(), 'de', pg.locator('#tab-hoje table.cmp tbody tr').count())
    pg.click('#tab-hoje button[data-action="sub"][data-sub="porque"]'); pg.wait_for_timeout(400)
    print('F porquê (seguidos):', pg.locator('#tab-hoje .card').filter(has_text='Em que se baseia').inner_text().replace('\n', ' | ')[:500])
    print('F largura:', width(pg))
    pg.close()

    # ---------- G: análise das previsões, histórico e especialistas (relógio no dia 2, de manhã) ----------
    db = seeded(); T = db['tables']
    T['runs'][0]['fictitious'] = False
    T['members'].append({'user_id': 'u-eu', 'role': 'member'})
    T['profiles'].append({'user_id': 'u-eu', 'display_name': 'João', 'topshot_username': 'gandapanasco'})
    d1 = run['days'][0]['date']
    proj = {d1: {'P': 0.62, 'lineup': ['sga', 'jbrown', 'cade', 'brunson', 'wemby'], 'o': [{'stat': 'pts', 'T': 130, 'mu': 128.4, 'sd': 13.1}], 'at': '2026-10-20T18:40:00Z',
        'pl': {'sga': [[31.6], 7.4, 'o', 0, 0.5], 'jbrown': [[26.3], 7.1, 'o', 1, 1], 'cade': [[26.9], 7.0, 'a', 0, 1], 'brunson': [[24.1], 6.8, 'o', 1, 1], 'wemby': [[24.0], 6.9, 'a', 0, 1], 'maxey': [[26.8], 7.0, 'o', 1, 1]}}}
    T['user_runs'] = [{'user_id': 'u-eu', 'run_id': 'run-1', 'roster': {pid: {'uses': 2, 'status': 'ok'} for pid in list(roster['players'])[:16]},
        'plan': {'proj': proj, 'played': {d1: {'done': True, 'result': 'win', 'lineup': ['sga', 'jbrown', 'cade', 'brunson', 'wemby'], 'chain': True, 'points': 141}}}, 'updated_at': '2026-10-21T10:00:00Z'}]
    T['injuries'] = []
    # jogos de ontem nos últimos jogos (o que fizeram): sga não jogou (jogou antes e depois), os outros sim
    for p_ in T['nba_players']:
        g = p_['avg']['form']['games']
        pts = {'jbrown': 31, 'cade': 22, 'brunson': 18, 'wemby': 30, 'maxey': 35}.get(p_['id'])
        if pts is not None: g.insert(0, [d1, 'X', 34, pts, 5, 4, 2, 10, 20, 4, 3, 4, 2, 1, 1, 1])
        if p_['id'] == 'sga': g.insert(0, ['2026-10-21', 'X', 30, 28, 5, 6, 1, 10, 20, 3, 8, 8, 2, 1, 1, 1])
        if p_['id'] == 'dlillard': p_['avg']['fg3'] = 3.6; p_['avg']['pts'] = 9
    T['chain_results'] = [{'user_id': 'u-eu', 'account': 'main', 'game_id': 'h%d' % k, 'chain_run_id': 'old%d' % (k // 10), 'date': '2026-0%d-%02d' % (3 + k // 10, 1 + k % 10), 'points': 120 + k, 'win': k % 3 != 0, 'lineup': ['Stephen Curry', 'Nikola Jokić'] if k % 2 else ['Stephen Curry', 'Jalen Brunson']} for k in range(20)]
    T['chain_games'] = [{'id': 'h%d' % k, 'run_id': 'old%d' % (k // 10), 'deadline': 0, 'num_players': 5, 'stats': [{'name': ['THREE_POINTERS_MADE', 'REBOUNDS', 'POINTS', 'THREE_POINTERS_MADE', 'ASSISTS'][k % 5], 'type': 1, 'valueNeeded': [13, 45, 130, 14, 30][k % 5]}]} for k in range(20)]
    T['chain_runs'] = [{'id': 'old0', 'name': 'Classic - Run 30', 'run_start': 1772323200, 'run_end': 1773187200}, {'id': 'old1', 'name': 'Classic - Run 31', 'run_start': 1774915200, 'run_end': 1775779200}] + T['chain_runs']
    # o Rui partilha o plano: tem o Jalen Johnson (só o usa no dia 8), o Gobert (usa-o nos dias 2 e 9) e o Mobley
    dates = [d['date'] for d in run['days']]
    T['summaries'][0]['share'] = {'roster': {'jjohnson': [2, 2, 1], 'gobert': [2, 2, 1], 'mobley': [1, 1, 1], 'curry': [3, 3, 1]},
        'use': {'jjohnson': [dates[7]], 'gobert': [dates[1], dates[8]], 'mobley': [dates[1]]},
        'lineups': {dates[1]: ['gobert', 'mobley', 'curry', 'jokic', 'sabonis'], dates[2]: ['curry', 'jokic']}}
    pg = new_page(b, db)
    pg.clock.set_fixed_time('2026-10-21T15:00:00Z')
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(3500)
    print('G previsões guardadas:', store(pg, 'Object.keys(__FAKE_DB.tables.user_runs[0].plan.proj).sort()'), '· reais de ontem:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.proj["' + d1 + '"].act'))
    snap = pg.evaluate('JSON.stringify(Object.entries(__FAKE_DB.tables.user_runs[0].plan.proj).filter(([d]) => d > "' + d1 + '").map(([d, x]) => [d, x.P, x.lineup.length, Object.keys(x.pl).length, x.o])[0])')
    print('G previsão do dia 2:', snap)
    pg.click('#t-run'); pg.wait_for_timeout(300)
    pg.click('#tab-run button[data-action="sub"][data-sub="analise"]'); pg.wait_for_timeout(400)
    print('G análise:', ' // '.join(x.replace('\n', ' | ')[:260] for x in pg.locator('#tab-run .card').all_inner_texts()))
    pg.screenshot(path=str(shots / 'run-analise.png'), full_page=True)
    pg.locator('#tab-run button[data-action="day"]').first.click(); pg.wait_for_timeout(300)
    print('G dia fechado:', pg.locator('#sheetPanel .card').filter(has_text='Previsto vs real').inner_text().replace('\n', ' | ')[:400])
    pg.screenshot(path=str(shots / 'dia-previsto-real.png'))
    pg.click('#sheetPanel button[data-action="close-sheet"]')
    pg.click('#tab-run button[data-action="sub"][data-sub="historico"]'); pg.wait_for_timeout(800)
    print('G histórico:', ' // '.join(x.replace('\n', ' | ')[:300] for x in pg.locator('#tab-run .card').all_inner_texts()))
    pg.screenshot(path=str(shots / 'run-historico.png'), full_page=True)
    pg.click('#t-plantel'); pg.wait_for_timeout(300)
    pg.click('#tab-plantel button[data-action="sub"][data-sub="comprar"]'); pg.wait_for_timeout(500)
    spec = pg.locator('#plSub .card').filter(has_text='Especialistas')
    print('G especialistas (chips):', ' | '.join(spec.locator('button[data-action="spec-stat"]').all_inner_texts()))
    pg.locator('#plSub button[data-action="spec-stat"][data-v="fg3"]').click(); pg.wait_for_timeout(300)
    spec = pg.locator('#plSub .card').filter(has_text='Especialistas')
    print('G especialistas 3PM:', spec.locator('li').count(), 'linhas ·', ' / '.join(x.replace('\n', ' ') for x in spec.locator('li').all_inner_texts()[:5]))
    spec.screenshot(path=str(shots / 'especialistas.png'))
    pg.click('#t-grupo'); pg.wait_for_timeout(400)
    pg.click('#tab-grupo button[data-action="sub"][data-sub="lineups"]'); pg.wait_for_timeout(400)
    print('G lineups do grupo:', ' // '.join(x.replace('\n', ' | ')[:220] for x in pg.locator('#tab-grupo .card').all_inner_texts()[:2]))
    print('G jogadores em comum sublinhados:', pg.locator('#tab-grupo .card').first.locator('.lu-same').count())
    pg.screenshot(path=str(shots / 'grupo-lineups.png'), full_page=True)
    pg.click('#tab-grupo button[data-action="sub"][data-sub="emprestimos"]'); pg.wait_for_timeout(300)
    print('G empréstimos (antes):', pg.locator('#tab-grupo .card.panel').inner_text().replace('\n', ' | ')[:300])
    pg.click('#tab-grupo button[data-action="borrow-run"]'); pg.wait_for_selector('#borrowProg', state='detached', timeout=90000); pg.wait_for_timeout(300)
    print('G empréstimos:', ' // '.join(x.replace('\n', ' | ')[:420] for x in pg.locator('#borrowOut .card').all_inner_texts()) or pg.locator('#borrowOut').inner_text())
    pg.screenshot(path=str(shots / 'grupo-emprestimos.png'), full_page=True)
    print('G partilha publicada:', store(pg, 'Object.keys((__FAKE_DB.tables.summaries.find(s=>s.user_id==="u-eu")||{}).share||{})'), '· usos de um jogador:', store(pg, '((__FAKE_DB.tables.summaries.find(s=>s.user_id==="u-eu")||{}).share||{}).roster?.sga'))
    pg.click('#t-ajustes'); pg.wait_for_timeout(300)
    pg.click('#tab-ajustes button[data-action="sub"][data-sub="perfil"]'); pg.wait_for_timeout(300)
    pg.click('#tab-ajustes button[data-action="share-plan"][data-v="0"]'); pg.wait_for_timeout(3500)
    print('G deixar de partilhar:', store(pg, '__FAKE_DB.tables.profiles.find(p=>p.user_id==="u-eu").share_plan'), '· partilha no resumo:', store(pg, '(__FAKE_DB.tables.summaries.find(s=>s.user_id==="u-eu")||{}).share'))
    pg.click('#tab-ajustes button[data-action="sub"][data-sub="prefs"]'); pg.wait_for_timeout(300)
    pg.click('#tab-ajustes button[data-action="theme"][data-v="dark"]'); pg.wait_for_timeout(200)
    bg = lambda: pg.evaluate('getComputedStyle(document.body).backgroundColor')
    print('G tema escuro:', pg.evaluate('document.documentElement.dataset.theme'), bg(), '·', pg.evaluate('[...document.querySelectorAll("meta[name=theme-color]")].map(m => m.content).join(" ")'))
    pg.reload(); pg.wait_for_timeout(800)
    print('G tema depois de recarregar:', pg.evaluate('document.documentElement.dataset.theme'), bg())
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(2500)
    pg.click('#t-ajustes'); pg.wait_for_timeout(300)
    pg.click('#tab-ajustes button[data-action="theme"][data-v="auto"]'); pg.wait_for_timeout(200)
    print('G tema automático:', pg.evaluate('document.documentElement.dataset.theme || "auto"'), bg())
    print('G largura:', width(pg))
    pg.close()

    # ---------- H: run nova ativa (o site estava numa run de teste) e dias que passaram sem resultado ----------
    db = seeded(); T = db['tables']
    T['runs'][0]['fictitious'] = False
    T['runs'].append({'id': 'teste-261015', 'name': 'Run de teste', 'mode': 'classic', 'start_date': '2026-10-15', 'end_date': '2026-10-25', 'prizes': [], 'active': False, 'fictitious': True})
    T['run_days'] += [{'run_id': 'teste-261015', 'date': '2026-10-%02d' % (15 + i), 'objectives': [{'stat': 'pts', 'target': 120}], 'games': [['PHX', 'CHI', '2026-10-%02dT23:00:00Z' % (15 + i), 't%d' % i]], 'chain_game_id': None} for i in range(11)]
    T['members'].append({'user_id': 'u-eu', 'role': 'member'})
    T['profiles'].append({'user_id': 'u-eu', 'display_name': 'João', 'topshot_username': 'gandapanasco'})
    T['user_runs'] = [{'user_id': 'u-eu', 'run_id': 'run-1', 'roster': {pid: {'uses': 2, 'status': 'ok'} for pid in list(roster['players'])[:16]}, 'plan': {}, 'updated_at': '2026-10-15T10:00:00Z'}]
    T['chain_results'] = []; T['injuries'] = []
    pg = new_page(b, db)
    pg.add_init_script("try { localStorage.setItem('fb-run', 'teste-261015'); localStorage.setItem('fb-run-act', 'teste-261015'); } catch (e) {}")
    pg.clock.set_fixed_time('2026-10-22T15:00:00Z')
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(3500)
    print('H run mostrada:', pg.locator('#hdr, header').first.inner_text().replace('\n', ' | ')[:120], '· aviso:', pg.locator('#toast').inner_text() if pg.locator('#toast').count() else '-')
    print('H hoje:', pg.locator('.hero .hero-top').inner_text().replace('\n', ' | ')[:80])
    print('H a fazer:', pg.locator('#tab-hoje .todo').inner_text().replace('\n', ' | ')[:300] if pg.locator('#tab-hoje .todo').count() else 'nada')
    gc = pg.locator('#tab-hoje .card').filter(has_text='Jogos de hoje')
    print('H jogos de hoje:', gc.inner_text().replace('\n', ' | ')[:300] if gc.count() else 'sem cartão')
    lineup_teams = pg.locator('#tab-hoje .card').filter(has_text='Jogo a jogo').locator('.row .ps').all_inner_texts()
    day3 = [g[:2] for g in run['days'][2]['games']]; teams3 = set(t for g in day3 for t in g)
    print('H lineup só com quem joga hoje:', all(any(t in x for t in teams3) for x in lineup_teams), len(lineup_teams))
    pg.screenshot(path=str(shots / 'hoje-dia3.png'), full_page=True)
    pg.click('#t-run'); pg.wait_for_timeout(300); pg.click('#tab-run button[data-action="sub"][data-sub="dias"]'); pg.wait_for_timeout(300)
    print('H dias:', ' // '.join(x.replace('\n', ' ') for x in pg.locator('#tab-run .drow').all_inner_texts()[:3]))
    print('H registo:', pg.locator('#tab-run .run-board, #hdr').first.inner_text().replace('\n', ' ')[:80] if pg.locator('#tab-run .run-board').count() else pg.evaluate('document.querySelector(".rec") && document.querySelector(".rec").textContent'))
    pg.locator('#tab-run .drow').first.click(); pg.wait_for_timeout(300)
    print('H registar dia 1:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:200])
    pg.click('#sheetPanel button[data-action="result"][data-res="win"]'); pg.wait_for_timeout(1500)
    print('H dia 1 registado:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.played'), '·', pg.evaluate('document.querySelector(".rec") && document.querySelector(".rec").textContent'))
    pg.locator('#tab-run .drow').nth(2).click(); pg.wait_for_timeout(300)
    print('H folha do dia 3 (jogos):', pg.locator('#sheetPanel .card').filter(has_text='hora de cá').inner_text().replace('\n', ' | ')[:300])
    pg.screenshot(path=str(shots / 'dia-jogos.png'))
    pg.close()
    b.close()

print('erros:', errors or 'nenhum')
