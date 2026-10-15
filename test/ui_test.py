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
    players = [{'id': pid, 'name': p['name'], 'team': p['team'], 'avg': p['avg'], 'gp': 20, 'updated_at': '2026-10-15T09:20:00Z'} for pid, p in roster['players'].items()]
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
        ct = {'html': 'text/html', 'js': 'application/javascript', 'css': 'text/css'}.get(name.rsplit('.', 1)[-1], 'text/plain')
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
    def row(k, names): return {'type': 'Array', 'value': [S(names[k % len(names)]), S('Metallic Gold LE' if k % 7 == 0 else 'Base Set'), S('8')]}
    def flow(r):
        body = json.loads(r.request.post_data); code = base64.b64decode(body['script']).decode()
        args = [json.loads(base64.b64decode(a)) for a in body['arguments']]
        h = {'access-control-allow-origin': '*'}
        names = wallets.get(args[0]['value'], allnames[:3])
        if 'TopShotMarketV3' in code:
            return r.fulfill(status=200, content_type='application/json', headers=h, body=cad({'type': 'Array', 'value': [{'type': 'Array', 'value': [S('Jalen Brunson'), S('Rookie Debut'), S('2')]}]}))
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
    print('B ao vivo:', store(pg, 'Object.values(__FAKE_DB.tables.user_runs[0].plan.live)[0].players'))
    print('B placar ao vivo:', pg.locator('.hero .bar-cap').inner_text().replace('\n', ' '))

    pg.click('#t-run'); pg.wait_for_timeout(400)
    print('B run:', ' / '.join(pg.locator('.prize').all_inner_texts()).replace('\n', ' '), '· dias', pg.locator('#tab-run .drow').count())
    print('B dia 1:', pg.locator('#tab-run .drow').first.inner_text().replace('\n', ' '))

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
    pg.click('#plBody button[data-action="wallet-sheet"]'); pg.wait_for_timeout(1500)
    print('B carteira:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:420])
    pg.screenshot(path=str(shots / 'carteira.png'))
    pg.click('#sheetPanel button[data-action="wallet-apply"]'); pg.wait_for_timeout(1200)
    print('B plantel depois da carteira:', store(pg, '{n: Object.keys(__FAKE_DB.tables.user_runs[0].roster).length, jokic: __FAKE_DB.tables.user_runs[0].roster["jokic"]}'))
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
    print('C hoje (sem carteiras):', pg.locator('.hero .impact').inner_text().replace('\n', ' ')[:160], '//', ' / '.join(pg.locator('#tab-hoje .note').all_inner_texts())[:200])
    print('C resultado da smurf lido:', store(pg, '{played: __FAKE_DB.tables.user_runs[0].plan.smurfs && __FAKE_DB.tables.user_runs[0].plan.smurfs.s1.played, jokic: __FAKE_DB.tables.user_runs[0].roster.jokic}'))
    pg.click('#t-plantel'); pg.wait_for_timeout(600)
    pg.click('#plBody button[data-action="wallet-sheet"]'); pg.wait_for_timeout(2500)
    print('C carteiras:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:300])
    pg.screenshot(path=str(shots / 'smurf-carteiras.png'))
    pg.click('#sheetPanel button[data-action="wallet-apply"]'); pg.wait_for_timeout(2500)
    print('C coleção guardada:', store(pg, '(() => { const c = __FAKE_DB.tables.profiles.find(p => p.user_id === "u-eu").collection; return { contas: c.accounts, jokic: c.players.jokic, sga: c.players.sga }; })()'))
    pg.screenshot(path=str(shots / 'smurf-plantel.png'), full_page=True)
    pg.click('#t-hoje'); pg.wait_for_timeout(800)
    print('C hoje:', pg.locator('.hero .impact').inner_text().replace('\n', ' ')[:200])
    print('C mandar hoje:', ' / '.join(pg.locator('#tab-hoje .card').nth(1).all_inner_texts()).replace('\n', ' | ')[:300])
    pg.screenshot(path=str(shots / 'smurf-hoje.png'), full_page=True)
    pg.click('#tab-hoje button[data-action="acc"][data-acc="s1"]'); pg.wait_for_timeout(500)
    print('C hoje smurf:', pg.locator('.hero').inner_text().replace('\n', ' | ')[:160], '// lineup:', ' / '.join(pg.locator('#tab-hoje .list .row .nm').all_inner_texts()))
    pg.screenshot(path=str(shots / 'smurf-hoje-s1.png'), full_page=True)
    pg.click('#tab-hoje button[data-action="alts"]'); pg.wait_for_timeout(9000)
    print('C alternativas smurf:', ' // '.join(x.replace('\n', ' | ')[:200] for x in pg.locator('#sheetPanel .card').all_inner_texts()))
    pg.click('#sheetPanel button[data-action="close-sheet"]')
    pg.click('#t-run'); pg.wait_for_timeout(500)
    print('C run contas:', pg.locator('#tab-run .card').first.inner_text().replace('\n', ' | ')[:300])
    print('C run transferências:', pg.locator('#tab-run .card').last.inner_text().replace('\n', ' | ')[:300])
    pg.screenshot(path=str(shots / 'smurf-run.png'), full_page=True)
    t0 = __import__('time').time()
    pg.click('#tab-run button[data-action="buy-sheet"]'); pg.wait_for_timeout(300)
    pg.click('#sheetPanel button[data-action="buy-mode"][data-mode="more"]'); pg.wait_for_timeout(200)
    pg.click('#sheetPanel button[data-action="buy-run"]'); pg.wait_for_timeout(300); pg.wait_for_selector('#buyProg', state='detached', timeout=120000)
    print('C compras com smurf (%.1f s):' % (__import__('time').time() - t0), ' // '.join(x.replace('\n', ' | ')[:260] for x in pg.locator('#buyOut .card').all_inner_texts()[:2]))
    pg.click('#sheetPanel button[data-action="close-sheet"]')
    pg.click('#t-plantel'); pg.wait_for_timeout(500)
    pg.locator('.mx-row:not(.head)').filter(has_text='Jokić').first.click(); pg.wait_for_timeout(300)
    print('C folha Jokić:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:300])
    pg.click('#sheetPanel button[data-action="uses"][data-acc="s1"][data-d="1"]'); pg.wait_for_timeout(1500)
    print('C usos da smurf mexidos:', store(pg, '__FAKE_DB.tables.user_runs[0].roster.jokic'))
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

    # ---------- D: admin cria e apaga uma run de teste ----------
    pg = new_page(b, seeded())
    pg.on('dialog', lambda d: d.accept())
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'amigo@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(1500)
    pg.click('#t-ajustes'); pg.wait_for_timeout(400)
    pg.click('#tab-ajustes button[data-action="test-run"]'); pg.wait_for_timeout(1500)
    print('D run de teste:', store(pg, '(() => { const r = __FAKE_DB.tables.runs.find(x => x.fictitious && x.id.startsWith("teste-")); const d = __FAKE_DB.tables.run_days.filter(x => x.run_id === r.id); return { id: r.id, ativa: r.active, dias: d.length, jogos: d.map(x => x.games.length), objetivos: d.map(x => x.objectives[0].stat + " " + x.objectives[0].target) }; })()'))
    pg.click('#t-plantel'); pg.wait_for_timeout(400)
    print('D plantel na run de teste:', pg.locator('#tab-plantel').inner_text().replace('\n', ' | ')[:160])
    pg.click('#t-ajustes'); pg.wait_for_timeout(300)
    pg.click('#tab-ajustes button[data-action="del-run"]'); pg.wait_for_timeout(1500)
    print('D depois de apagar:', store(pg, '__FAKE_DB.tables.runs.map(r => r.id)'))
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
    print('E lineup dia 1:', ' / '.join(pg.locator('#tab-hoje .list .row .nm').all_inner_texts()[:5]))
    print('E linhas com lesão:', ' / '.join(x.replace('\n', ' ') for x in pg.locator('#tab-hoje .row').filter(has_text='lesão').all_inner_texts())[:300])
    print('E em que se baseia:', pg.locator('#tab-hoje .basis-day').inner_text().replace('\n', ' | ')[:900])
    pg.screenshot(path=str(shots / 'hoje-baseia.png'), full_page=True)
    print('E próximos lineups publicados:', store(pg, 'Object.keys((__FAKE_DB.tables.user_runs[0].plan.next || {}).main || {})'))
    pg.locator('#tab-hoje .basis-day button[data-action="player"]').first.click(); pg.wait_for_timeout(300)
    print('E ficha (em que se baseia):', pg.locator('#sheetPanel .basis').inner_text().replace('\n', ' | ')[:700])
    pg.screenshot(path=str(shots / 'ficha-baseia.png'), full_page=True)
    pg.click('#sheetPanel button[data-action="close-sheet"]')
    pg.locator('#tab-hoje .list').first.locator('button[data-action="player"]').filter(has_text='Gilgeous').click(); pg.wait_for_timeout(300)
    print('E ficha SGA (lesão):', pg.locator('#sheetPanel .note').first.inner_text().replace('\n', ' | ')[:300], '//', pg.locator('#sheetPanel .basis').inner_text().replace('\n', ' | ')[:400])
    pg.screenshot(path=str(shots / 'ficha-lesao.png'), full_page=True)
    pg.click('#sheetPanel button[data-action="close-sheet"]')
    pg.click('#t-plantel'); pg.wait_for_timeout(500)
    print('E plantel lesões:', pg.locator('#plBody .card').filter(has_text='No relatório de lesões').inner_text().replace('\n', ' | ')[:300])
    pg.locator('#plBody .card').filter(has_text='No relatório de lesões').locator('button[data-action="pl-sheet"]').filter(has_text='Maxey').click(); pg.wait_for_timeout(300)
    print('E ficha Maxey:', pg.locator('#sheetPanel .note').first.inner_text().replace('\n', ' | ')[:300])
    pg.click('#sheetPanel button[data-action="inj-ignore"]'); pg.wait_for_timeout(1200)
    print('E ignorar relatório:', store(pg, '__FAKE_DB.tables.user_runs[0].roster.maxey'), '·', pg.locator('#sheetPanel .note').first.inner_text().replace('\n', ' | ')[:160])
    pg.click('#sheetPanel button[data-action="inj-ignore"]'); pg.wait_for_timeout(1200)
    pg.click('#sheetPanel button[data-action="close-sheet"]')
    pg.screenshot(path=str(shots / 'plantel-lesoes.png'), full_page=True)
    pg.click('#t-ajustes'); pg.wait_for_timeout(400)
    print('E ajustes sem avisos (desligados por agora):', pg.locator('#tab-ajustes h2').all_inner_texts() if pg.click('#t-ajustes') is None and pg.wait_for_timeout(400) is None else '')
    pg.click('#t-run'); pg.wait_for_timeout(500)
    pg.click('#tab-run button[data-action="buy-sheet"]'); pg.wait_for_timeout(300)
    t0 = __import__('time').time()
    pg.click('#sheetPanel button[data-action="buy-run"]'); pg.wait_for_timeout(300); pg.wait_for_selector('#buyProg', state='detached', timeout=90000)
    print('E compras (%.1f s):' % (__import__('time').time() - t0), ' // '.join(x.replace('\n', ' | ')[:330] for x in pg.locator('#buyOut .card').all_inner_texts()[:3]))
    pg.screenshot(path=str(shots / 'compras.png'), full_page=True)
    pg.fill('#buySearch', 'Curry'); pg.wait_for_timeout(200)
    pg.click('#buyFound button[data-action="buy-pick"]'); pg.wait_for_timeout(300); pg.wait_for_selector('#buyProg', state='detached', timeout=90000)
    print('E avaliar Curry:', pg.locator('#buyOut').inner_text().replace('\n', ' | ')[:400])
    pg.click('#sheetPanel button[data-action="buy-mode"][data-mode="more"]'); pg.wait_for_timeout(200)
    pg.click('#sheetPanel button[data-action="buy-run"]'); pg.wait_for_timeout(300); pg.wait_for_selector('#buyProg', state='detached', timeout=90000)
    print('E mais usos:', ' // '.join(x.replace('\n', ' | ')[:200] for x in pg.locator('#buyOut .card').all_inner_texts()[:2]))
    pg.click('#sheetPanel button[data-action="close-sheet"]')
    print('E largura:', width(pg))
    pg.close()
    b.close()

print('erros:', errors or 'nenhum')
