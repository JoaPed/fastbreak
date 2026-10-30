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

# o site em inglês (docs/app.en.js) tem de estar gerado a partir do app.js atual
import subprocess
chk = subprocess.run(['node', str(root / 'scripts' / 'build-en.mjs'), '--check'], capture_output=True, text=True)
print('inglês:', (chk.stdout or chk.stderr).strip())
if chk.returncode and not __import__('os').environ.get('FB_SKIP_EN'): sys.exit(1)  # FB_SKIP_EN=1: só para ensaios a meio de uma mudança

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
    pg.route('https://a.espncdn.com/**', lambda r: r.abort())  # fotos dos jogadores: sem rede no teste (fica a inicial)
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
        return {'type': 'Array', 'value': [S(names[k % len(names)]), S(nm), S('8'), S(str(k)), S(str(sid)), S(str(k % 50)), S(''), S(''), S(str(1000 + k))]}
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
def lineup_card(pg): return pg.locator('#tab-hoje .card').filter(has=pg.locator('button[data-k="lineup"], button[data-k="aovivo"]'))
def wait_opcoes(pg, ms=90000): pg.wait_for_function("() => !document.getElementById('opProg')", timeout=ms); pg.wait_for_timeout(200)
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
    pg.click('#meBtn'); pg.wait_for_timeout(300); pg.click('#tab-ajustes button[data-action="sub"][data-sub="admin"]'); pg.wait_for_timeout(500)
    pg.fill('#invCode', 'amigos26'); pg.click('#inviteForm button'); pg.wait_for_timeout(300)
    # as runs já não se criam à mão (chegam da blockchain): o Admin tem as leituras do Top Shot
    print('A admin sem criar runs:', pg.locator('#newRunForm').count() == 0, '· leituras:', ' / '.join(pg.locator('#tab-ajustes button[data-action="ranks-go"]').all_inner_texts()))
    print('A base:', store(pg, '{runs: __FAKE_DB.tables.runs.map(r=>[r.id,r.active]), dias: __FAKE_DB.tables.run_days.length, convite: __FAKE_DB.tables.settings, membros: __FAKE_DB.tables.members, perfil: __FAKE_DB.tables.profiles}'))
    pg.wait_for_timeout(300); print('A tarefas:', pg.locator('#tab-ajustes .card').filter(has_text='Tarefas').inner_text().replace('\n', ' | '))
    pg.click('#tab-ajustes button[data-action="job-odds"]'); pg.wait_for_timeout(800)
    print('A pedir odds:', pg.locator('#toast').inner_text(), '·', pg.locator('#tab-ajustes .card').filter(has_text='Tarefas').inner_text().replace('\n', ' | '), '·', store(pg, '__FAKE_DB.tables.job_state'))
    print('A largura ajustes:', width(pg))
    pg.close()

    # ---------- B: amigo entra com o código e usa o planeador ----------
    pg = new_page(b, seeded())
    pg.clock.set_fixed_time('2026-10-21T15:00:00Z')  # dia 2, antes dos jogos (o dia 1 já fechou na blockchain)
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(400)
    pg.fill('#joinCode', 'errado'); pg.click('#joinForm button[type="submit"]'); pg.wait_for_timeout(300)
    print('B código errado:', pg.locator('.err').inner_text())
    pg.fill('#joinCode', 'AMIGOS26'); pg.click('#joinForm button[type="submit"]'); pg.wait_for_timeout(400)
    pg.click('#profForm button[type="submit"]'); pg.wait_for_timeout(900)
    print('B hoje sem plantel:', pg.locator('#tab-hoje').inner_text().replace('\n', ' | ')[:100])
    print('B resultado da blockchain aplicado:', store(pg, '(__FAKE_DB.tables.user_runs[0]||{}).plan'))
    pg.click('#t-plantel'); pg.wait_for_timeout(300)
    pg.locator('#plSub button[data-action="add-player"]').first.click(); pg.wait_for_timeout(200)
    pg.click('#sheetPanel button[data-action="paste-sheet"]'); pg.wait_for_timeout(200)
    pg.fill('#pasteText', 'Jokic 2\nWembanyama 3\nShai Gilgeous-Alexander 2\nLuka 2\nBrunson 3, Cade Cunningham 3\nSabonis 4\nGobert 5; Maxey 3\nJalen Johnson 4\nDaniels 5\nMobley 4\nChet 4\nLopez 5\nAnthony Edwards 3\nMitchell 3\nCurry 2\nSengun 4\nZzzz Inventado 1')
    pg.click('button[data-action="paste-preview"]'); pg.wait_for_timeout(200)
    print('B correspondências:', ' / '.join(pg.locator('#pasteOut li').all_inner_texts())[:500])
    pg.click('button[data-action="paste-apply"]'); pg.wait_for_timeout(1200)
    print('B plantel:', pg.locator('#plBody .pl-card').count(), 'jogadores · largura', width(pg))
    pg.screenshot(path=str(shots / 'plantel.png'))
    pg.locator('#plBody .pl-card').first.click(); pg.wait_for_timeout(200)
    pg.click('#sheetPanel button[data-action="uses"][data-d="1"]'); pg.wait_for_timeout(900)
    pg.click('#sheetPanel button[data-action="close-sheet"]')

    pg.click('#t-hoje'); pg.wait_for_timeout(500)
    print('B hoje:', pg.locator('.hero').inner_text().replace('\n', ' | ')[:200])
    print('B lineup:', pg.locator('#tab-hoje .list .row').count(), 'jogadores · largura', width(pg))
    pg.screenshot(path=str(shots / 'hoje.png'))
    # ajuda ao toque: o (?) do lineup abre a explicação numa folha
    pg.locator('#tab-hoje button[data-action="help"][data-k="lineup"]').click(); pg.wait_for_timeout(200)
    print('B ajuda do lineup:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:160])
    pg.click('#sheetPanel button[data-action="close-sheet"]'); pg.wait_for_timeout(200)
    # Opções para hoje (antes dos jogos): o plano, tudo pelo dia, guardar um jogador
    pg.click('#tab-hoje button[data-action="opcoes"]'); wait_opcoes(pg)
    print('B opções:', ' // '.join(x.replace('\n', ' | ')[:200] for x in pg.locator('#sheetPanel .op-card').all_inner_texts()))
    pg.locator('#sheetPanel button[data-action="help"][data-k="opcoes"]').click(); pg.wait_for_timeout(200)
    print('B ajuda dentro da folha:', pg.locator('#sheetPanel #help-opcoes').count(), '·', pg.locator('#sheetPanel button[data-k="opcoes"]').get_attribute('aria-expanded'))
    pg.screenshot(path=str(shots / 'opcoes.png'), full_page=True)
    alt = pg.locator('#sheetPanel .op-card').filter(has_not_text='o melhor').locator('button[data-action="op-use"]')
    (alt if alt.count() else pg.locator('#sheetPanel button[data-action="op-use"]')).first.click(); pg.wait_for_timeout(1500)
    print('B opção escolhida:', pg.locator('#toast').inner_text(), '·', store(pg, '__FAKE_DB.tables.user_runs[0].plan.locks'), '·', store(pg, '__FAKE_DB.tables.user_runs[0].plan.bans'), '· hoje:', pg.locator('.hero .win-ring .wr-v').inner_text().replace('\n', ' '))
    pg.click('#tab-hoje button[data-action="opcoes"]'); wait_opcoes(pg)
    clear = pg.locator('#sheetPanel .op-card').filter(has_text='sem as tuas escolhas').locator('button[data-action="op-use"]')
    if clear.count():
        clear.click(); pg.wait_for_timeout(1200)
        print('B voltou ao plano:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.locks'), store(pg, '__FAKE_DB.tables.user_runs[0].plan.bans'))
    else:
        print('B opções (2.ª vez):', ' // '.join(x.replace('\n', ' | ')[:120] for x in pg.locator('#sheetPanel .op-card').all_inner_texts()))
        pg.click('#sheetPanel button[data-action="close-sheet"]')
    # ao vivo: passa sozinho quando o 1.º jogo começa (sem botão)
    print('B antes dos jogos:', pg.locator('.hero .jc-txt').inner_text().replace('\n', ' '))
    pg.clock.set_fixed_time('2026-10-22T02:40:00Z')
    pg.evaluate('document.dispatchEvent(new Event("visibilitychange"))')
    pg.wait_for_function('() => { const l = (__FAKE_DB.tables.user_runs[0].plan || {}).live; return l && Object.values(l)[0] && Object.keys(Object.values(l)[0].players || {}).length; }', timeout=15000)
    pg.wait_for_timeout(500)
    print('B ao vivo (sozinho):', pg.locator('.hero .jc-txt').inner_text().replace('\n', ' '))
    print('B ao vivo:', store(pg, 'Object.values(__FAKE_DB.tables.user_runs[0].plan.live)[0].players'))
    print('B placar ao vivo:', pg.locator('.hero .jc-sub').first.inner_text().replace('\n', ' '))

    pg.click('#t-run'); pg.wait_for_timeout(400)
    print('B run (prémios):', pg.locator('#tab-run .run-board').inner_text().replace('\n', ' | '), '// distribuição:', pg.locator('#tab-run .dist i').count(), 'barras ·', pg.locator('#tab-run .dist-legend').inner_text().replace('\n', ' '))
    pg.screenshot(path=str(shots / 'run-premios.png'), full_page=True)
    print('B run separadores:', pg.locator('#tab-run [role="tablist"]').first.inner_text().replace('\n', ' | '))

    pg.click('#t-grupo'); pg.wait_for_timeout(2900)
    pg.click('button[data-action="group-refresh"]'); pg.wait_for_timeout(500)
    print('B grupo:', ' // '.join(pg.locator('#tab-grupo .gc tbody tr').all_inner_texts()).replace('\n', ' ')[:400])
    print('B grupo largura:', width(pg))
    pg.screenshot(path=str(shots / 'grupo.png'))
    pg.locator('#tab-grupo .gc tbody tr').first.click(); pg.wait_for_timeout(200)
    print('B folha amigo:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:200])
    pg.click('#sheetPanel button[data-action="close-sheet"]')

    pg.click('#meBtn'); pg.wait_for_timeout(400)
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
    pg.click('#plSub button[data-action="wallet-sheet"]'); pg.wait_for_timeout(1500)
    print('B ler outra vez:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:200])
    pg.click('#sheetPanel [data-action="close-sheet"]'); pg.wait_for_timeout(300)
    print('B usos pelo escalão:', store(pg, 'Object.fromEntries(Object.entries(__FAKE_DB.tables.profiles.find(p => p.user_id === "u-eu").collection.players).slice(0, 4).map(([k, c]) => [k, [c.bySet, c.uses]]))'))
    pg.wait_for_timeout(300)
    print('B coleção (sem o cartão dos escalões por set):', pg.locator('#plSub select[data-tier-set]').count() == 0, '·', pg.locator('#plSub .col-sum').inner_text().replace('\n', ' | ')[:200])
    # escalão carta a carta: das cartas de um jogador, a melhor (Holo Icon, Legendary pela tiragem) passa a Common → usos 1
    name1 = [x['name'] for x in roster['players'].values()][1]; pid1 = list(roster['players'])[1]
    pg.click('#tab-plantel button[data-action="sub"][data-sub="plantel"]'); pg.wait_for_timeout(300)
    pg.locator('#plBody .pl-card').filter(has_text=name1).first.click(); pg.wait_for_timeout(300)
    cc = pg.locator('#sheetPanel .card').filter(has_text='As tuas cartas')
    print('B cartas de', name1 + ':', cc.inner_text().replace('\n', ' | ')[:260] if cc.count() else 'sem cartão', '· seletores:', pg.locator('#sheetPanel select[data-mo-tier]').count())
    if cc.count():
        fid = pg.locator('#sheetPanel select[data-mo-tier]').first.get_attribute('data-mo-tier')
        pg.select_option('#sheetPanel select[data-mo-tier="%s"]' % fid, 'Common'); pg.wait_for_timeout(900)
        print('B carta', fid, '→ Common:', pg.locator('#toast').inner_text(), '· Luka:', store(pg, '__FAKE_DB.tables.user_runs[0].roster["luka"] && __FAKE_DB.tables.user_runs[0].roster["luka"].uses'), '·', store(pg, '{mt: __FAKE_DB.tables.profiles.find(p => p.user_id === "u-eu").collection.mt, usos: __FAKE_DB.tables.user_runs[0].roster["%s"].uses}' % pid1))
        print('B depois:', pg.locator('#sheetPanel .card').filter(has_text='As tuas cartas').locator('.list-head').inner_text().replace('\n', ' ')[:160])
        pg.locator('#sheetPanel button[data-action="help"][data-k="cartas"]').click(); pg.wait_for_timeout(200)
        print('B ajuda das cartas (na folha):', pg.locator('#sheetPanel #help-cartas').inner_text()[:120])
        pg.evaluate('document.querySelector("#sheetPanel .mo-row").scrollIntoView()'); pg.wait_for_timeout(100)
        pg.screenshot(path=str(shots / 'cartas.png'))
        pg.select_option('#sheetPanel select[data-mo-tier="%s"]' % fid, 'Rare+'); pg.wait_for_timeout(900)
        print('B carta → Rare+ (3 usos):', pg.locator('#toast').inner_text())
        pg.select_option('#sheetPanel select[data-mo-tier="%s"]' % fid, 'Legendary'); pg.wait_for_timeout(900)
        print('B carta', fid, '→ Legendary:', store(pg, '{mt: __FAKE_DB.tables.profiles.find(p => p.user_id === "u-eu").collection.mt, usos: __FAKE_DB.tables.user_runs[0].roster["%s"].uses}' % pid1))
        print('B aprendido (Luka, 2 Holo Icon):', store(pg, '{usos: __FAKE_DB.tables.user_runs[0].roster["luka"] && __FAKE_DB.tables.user_runs[0].roster["luka"].uses, tl: __FAKE_DB.tables.profiles.find(p => p.user_id === "u-eu").collection.tl}'), '·', pg.locator('#toast').inner_text())
    pg.click('#sheetPanel button[data-action="close-sheet"]'); pg.wait_for_timeout(200)
    pg.click('#meBtn'); pg.wait_for_timeout(300)
    pg.click('#tab-ajustes button[data-action="logout"]'); pg.wait_for_timeout(300)
    print('B depois de sair:', pg.locator('#auSubmit').inner_text())
    # Moments novos desde a última leitura: tira 3 da coleção guardada, entra outra vez e lê a carteira
    pg.evaluate('(() => { const c = __FAKE_DB.tables.profiles.find(p => p.user_id === "u-eu").collection; Object.keys(c.items).slice(0, 3).forEach(k => delete c.items[k]); })()')
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(2500)
    pg.click('#t-plantel'); pg.wait_for_timeout(300); pg.click('#tab-plantel button[data-action="sub"][data-sub="colecao"]'); pg.wait_for_timeout(300)
    pg.click('#plSub button[data-action="wallet-sheet"]'); pg.wait_for_timeout(1500)
    nn = pg.locator('#sheetPanel .note.info').filter(has_text='Moments novos')
    print('B Moments novos:', nn.inner_text().replace('\n', ' ')[:200] if nn.count() else 'ERRO sem aviso')
    pg.click('#sheetPanel button[data-action="wallet-apply"]'); pg.wait_for_timeout(300)
    print('B aviso ao guardar:', pg.locator('#toast').inner_text(), '· ok' if '+3' in pg.locator('#toast').inner_text() else '· ERRO')
    pg.wait_for_timeout(1000)
    pg.click('#meBtn'); pg.wait_for_timeout(300); pg.click('#tab-ajustes button[data-action="logout"]'); pg.wait_for_timeout(300)

    # ---------- C: conta com uma smurf (coleções juntas, plano conjunto, transferências) ----------
    db = seeded(); T = db['tables']
    T['members'].append({'user_id': 'u-eu', 'role': 'member'})
    T['profiles'].append({'user_id': 'u-eu', 'display_name': 'João', 'topshot_username': 'gandapanasco', 'flow_address': '0xe7fb03955ade55fa', 'smurfs': [{'id': 's1', 'topshot_username': 'joao_smurf', 'flow_address': '0x0000000000000a01'}]})
    T['user_runs'] = [{'user_id': 'u-eu', 'run_id': 'run-1', 'roster': {pid: {'uses': 2, 'status': 'ok'} for pid in roster['players']}, 'plan': {}, 'updated_at': '2026-10-15T10:00:00Z'}]
    T['chain_results'].append({'user_id': 'u-eu', 'account': 's1', 'game_id': 'g1', 'chain_run_id': 'cr1', 'date': run['days'][0]['date'], 'points': 140, 'win': True, 'lineup': ['Nikola Jokić']})
    # mercado (tarefa "Mercado"): Jokić à venda e vendido
    T['market_asks'] = [{'listing_id': 'l1', 'nft_id': 1, 'price': 3.5, 'player': 'Nikola Jokić', 'player_id': 'nikola-jokic', 'tier': 'Common', 'serial': 9876, 'set_name': 'Base Set', 'active': True},
                        {'listing_id': 'l2', 'nft_id': 2, 'price': 2.25, 'player': 'Nikola Jokić', 'player_id': 'nikola-jokic', 'tier': 'Common', 'serial': 14001, 'set_name': 'Base Set', 'active': True},
                        {'listing_id': 'l3', 'nft_id': 3, 'price': 89, 'player': 'Nikola Jokić', 'player_id': 'nikola-jokic', 'tier': 'Rare', 'serial': 77, 'set_name': 'Metallic Gold LE', 'active': True},
                        {'listing_id': 'l4', 'nft_id': 4, 'price': 1, 'player': 'Nikola Jokić', 'player_id': 'nikola-jokic', 'tier': 'Common', 'serial': 5, 'set_name': 'Base Set', 'active': False}]
    T['market_sales'] = [{'listing_id': 's1', 'nft_id': 5, 'price': 2.4, 'sold_at': '2026-10-16T09:00:00Z', 'player': 'Nikola Jokić', 'player_id': 'nikola-jokic', 'tier': 'Common'},
                         {'listing_id': 's2', 'nft_id': 6, 'price': 95, 'sold_at': '2026-10-15T20:00:00Z', 'player': 'Nikola Jokić', 'player_id': 'nikola-jokic', 'tier': 'Rare'}]
    pg = new_page(b, db)
    pg.clock.set_fixed_time('2026-10-21T15:00:00Z')
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(2500)
    print('C contas:', pg.locator('#tab-hoje .j-accs').inner_text().replace('\n', ' | ') if pg.locator('#tab-hoje .j-accs').count() else 'sem seletor')
    print('C a fazer (sem carteiras):', pg.locator('#tab-hoje .todo').inner_text().replace('\n', ' | ')[:300] if pg.locator('#tab-hoje .todo').count() else 'nada')
    print('C hoje (sem carteiras):', pg.locator('#tab-hoje .j-accs').inner_text().replace('\n', ' ')[:160], '//', ' / '.join(pg.locator('#tab-hoje .note').all_inner_texts())[:200])
    try: pg.wait_for_function('() => { const p = (__FAKE_DB.tables.user_runs[0] || {}).plan || {}; return p.smurfs && p.smurfs.s1 && p.smurfs.s1.played; }', timeout=15000)  # gravação atrasada pelo cálculo
    except Exception: pass
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
    print('C hoje:', pg.locator('#tab-hoje .j-accs').inner_text().replace('\n', ' ')[:200])
    print('C a fazer:', pg.locator('#tab-hoje .todo').inner_text().replace('\n', ' | ')[:400] if pg.locator('#tab-hoje .todo').count() else 'nada')
    print('C mandar hoje:', ' / '.join(pg.locator('#tab-hoje .card').nth(1).all_inner_texts()).replace('\n', ' | ')[:300])
    pg.click('#t-plantel'); pg.wait_for_timeout(300); pg.click('#tab-plantel button[data-action="sub"][data-sub="plantel"]'); pg.wait_for_timeout(300); pg.click('#t-hoje'); pg.wait_for_timeout(500)
    pg.screenshot(path=str(shots / 'smurf-hoje.png'), full_page=True)
    pg.click('#tab-hoje button[data-action="acc"][data-acc="s1"]'); pg.wait_for_timeout(500)
    print('C hoje smurf:', pg.locator('.hero').inner_text().replace('\n', ' | ')[:160], '// lineup:', ' / '.join(pg.locator('#tab-hoje .list .row .nm').all_inner_texts()))
    pg.screenshot(path=str(shots / 'smurf-hoje-s1.png'), full_page=True)
    pg.click('#t-run'); pg.wait_for_timeout(300); pg.click('#tab-run button[data-action="sub"][data-sub="contas"]'); pg.wait_for_timeout(500)
    trc = pg.locator('#tab-run .card').filter(has_text='Transferências')
    print('C transferências:', trc.inner_text().replace('\n', ' | ')[:400] if trc.count() else 'sem cartão')
    pg.click('#tab-run button[data-action="sub"][data-sub="premios"]'); pg.wait_for_timeout(300)
    pg.click('#t-hoje'); pg.wait_for_timeout(400)
    print('C a fazer (com trocas):', pg.locator('#tab-hoje .todo').inner_text().replace('\n', ' | ')[:300] if pg.locator('#tab-hoje .todo').count() else 'nada')
    # mandar um Moment marcado como feito: o plano passa a contar com ele na outra conta (sai o "Mandar de")
    trk = pg.locator('#tab-hoje .todo .todo-ck[data-k*="|tr|"][aria-pressed="false"]')
    if trk.count():
        k0 = trk.first.get_attribute('data-k'); m0 = trk.count()
        pid_, acc_ = k0.split('|tr|')[1].split('|')[0], k0.split('>')[1].split('|')[0]
        pg.click('#tab-hoje button[data-action="acc"][data-acc="%s"]' % acc_); pg.wait_for_timeout(500)
        badge = lambda: pg.evaluate("(n) => [...document.querySelectorAll('#tab-hoje .row')].filter(r => r.textContent.includes(n) && r.textContent.includes('Mandar de')).length", nm_)
        nm_ = pg.evaluate("(id) => (__FAKE_DB.tables.user_runs[0].roster[id] || {}).name || id", pid_); nm_ = nm_.split(' ')[-1]
        b0 = badge()
        pg.click('#tab-hoje button[data-action="acc"][data-acc="main"]'); pg.wait_for_timeout(400)
        pg.locator('#tab-hoje .todo .todo-ck[data-k="%s"]' % k0).click(); pg.wait_for_timeout(2500)
        pg.click('#tab-hoje button[data-action="acc"][data-acc="%s"]' % acc_); pg.wait_for_timeout(500)
        print('C mandado (%s → %s): trocas por fazer %d → %d · "Mandar de" na conta %d → %d' % (pid_, acc_, m0, pg.locator('#tab-hoje .todo .todo-ck[data-k*="|tr|"][aria-pressed="false"]').count(), b0, badge()))
        pg.click('#tab-hoje button[data-action="acc"][data-acc="main"]'); pg.wait_for_timeout(400)
        pg.evaluate("localStorage.removeItem('fb-todo')")
    n0 = pg.locator('#tab-hoje .todo .todo-ck[aria-pressed="false"]').count()
    if n0:
        pg.locator('#tab-hoje .todo .todo-ck').first.click(); pg.wait_for_timeout(300)
        pg.click('#tab-hoje .todo button[data-action="todo-show"]'); pg.wait_for_timeout(200); pg.locator('#tab-hoje .todo').screenshot(path=str(shots / 'a-fazer.png')); pg.click('#tab-hoje .todo button[data-action="todo-show"]'); pg.wait_for_timeout(200)
        n1 = pg.locator('#tab-hoje .todo .todo-ck[aria-pressed="false"]').count(); seen = pg.locator('#tab-hoje .todo button[data-action="todo-show"]').inner_text()
        saved = pg.evaluate("Object.keys(JSON.parse(localStorage.getItem('fb-todo') || '{}')).length")
        pg.click('#t-run'); pg.wait_for_timeout(300); pg.click('#t-hoje'); pg.wait_for_timeout(400)
        n2 = pg.locator('#tab-hoje .todo .todo-ck[aria-pressed="false"]').count() if saved == 1 else -1
        pg.click('#tab-hoje .todo button[data-action="todo-show"]'); pg.wait_for_timeout(200)
        pg.locator('#tab-hoje .todo .todo-ck[aria-pressed="true"]').first.click(); pg.wait_for_timeout(300)
        n3 = pg.locator('#tab-hoje .todo .todo-ck[aria-pressed="false"]').count()
        print('C a fazer com visto:', n0, '→', n1, '·', seen, '· guardado e de volta à Hoje:', n2, '· desmarcado:', n3, '· ok' if n1 == n0 - 1 and n2 == n1 and n3 == n0 else '· ERRO')
    else: print('C a fazer com visto: ERRO sem itens para marcar')
    pg.click('#tab-hoje button[data-action="opcoes"]'); wait_opcoes(pg, 120000)
    print('C opções smurf:', ' // '.join(x.replace('\n', ' | ')[:200] for x in pg.locator('#sheetPanel .op-card').all_inner_texts()))
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
    pg.click('#plSub button[data-action="buy-mode"][data-mode="new"]'); pg.wait_for_timeout(200)
    pg.click('#plSub button[data-action="buy-run"]'); pg.wait_for_timeout(300); pg.wait_for_selector('#buyProg', state='detached', timeout=120000)
    names2 = [x.split('. ', 1)[-1] for x in pg.locator('#buyOut .buy-row .nm').all_inner_texts()]
    two = [x for x in pg.locator('#buyOut .buy-row').all_inner_texts() if '2.º Moment' in x or 'mesmo dia' in x]
    print('C compras Todos com smurf:', len(names2), 'candidatos ·', ', '.join(names2), '· 2.º Moment:', len(two))
    # preço máximo: só quem tem um Moment Rare à venda até esse preço (o Jokić Rare está a $89)
    pg.fill('#buyMax', '50'); pg.click('#plSub button[data-action="buy-run"]'); pg.wait_for_timeout(300); pg.wait_for_selector('#buyProg', state='detached', timeout=120000)
    print('C compras até $50:', pg.locator('#buyOut').inner_text().replace('\n', ' | ')[:240])
    pg.fill('#buyMax', ''); pg.evaluate("document.getElementById('buyMax').dispatchEvent(new Event('input', {bubbles: true}))"); pg.evaluate("document.getElementById('buyMax').blur()")
    pg.wait_for_function("() => { const c = [...document.querySelectorAll('#plSub .card')].find(x => /Os Rare que mais compensam/.test(x.textContent)); return c && !/A testar|a atualizar/.test(c.textContent); }", timeout=180000)
    tips = pg.locator('#plSub .card').filter(has_text='Os Rare que mais compensam').inner_text().replace('\n', ' | ')
    print('C sugestões Rare com smurf:', tips[:400], '· 2.º Moment:', tips.count('2.º Moment'))
    pg.click('#tab-plantel button[data-action="sub"][data-sub="plantel"]'); pg.wait_for_timeout(300); 
    pg.click('#t-plantel'); pg.wait_for_timeout(500)
    pg.click('#plBody button[data-action="pl-view"][data-v="plano"]'); pg.wait_for_timeout(400)
    pg.screenshot(path=str(shots / 'smurf-matriz.png'))
    print('C noites na outra conta (plano por dia):', pg.locator('#plSub .dot.other').count(), '·', pg.locator('#plSub .legend').inner_text().replace('\n', ' '))
    pg.locator('#plBody .pl-card').filter(has_text='Jokić').first.click(); pg.wait_for_timeout(300)
    print('C folha Jokić:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:300])
    pg.wait_for_timeout(500); print('C mercado Jokić:', pg.locator('#sheetPanel .mkt-box').inner_text().replace('\n', ' | ') if pg.locator('#sheetPanel .mkt-box').count() else '-')
    print('C Jokić nas contas:', pg.locator('#sheetPanel .note').first.inner_text().replace('\n', ' | ') if pg.locator('#sheetPanel .note').count() else '-')
    # com Moments na coleção os usos de cada conta são os da melhor carta, sem stepper, e o que estava gravado à mão é apagado
    print('C usos fixos pela coleção:', ' / '.join(pg.locator('#sheetPanel .uses-fixed').all_inner_texts()), '· steppers:', pg.locator('#sheetPanel button[data-action="uses"]').count(), '· gravado:', store(pg, '__FAKE_DB.tables.user_runs[0].roster.jokic'))
    pg.click('#sheetPanel button[data-action="close-sheet"]')
    both = pg.evaluate('(() => { const col = __FAKE_DB.tables.profiles.find(p => p.user_id === "u-eu").collection.players, r = __FAKE_DB.tables.user_runs[0].roster; return Object.keys(r).find(id => col[id] && col[id].owners && col[id].owners.main && col[id].owners.s1 && !(r[id].su && r[id].su.s1 != null)); })()')
    if both:
        pg.locator('#plSub .pl-card[data-id="' + both + '"]').click(); pg.wait_for_timeout(300)
        print('C Moments nas duas contas (' + both + '):', pg.locator('#sheetPanel .note').first.inner_text().replace('\n', ' | ')[:300] if pg.locator('#sheetPanel .note').count() else '-', '· usos por conta:', ' / '.join(pg.locator('#sheetPanel .stepper .v, #sheetPanel [data-action="uses"] ~ .v').all_inner_texts())[:80])
        pg.click('#sheetPanel button[data-action="close-sheet"]')
    one = pg.evaluate('(() => { const col = __FAKE_DB.tables.profiles.find(p => p.user_id === "u-eu").collection.players; return Object.keys(__FAKE_DB.tables.user_runs[0].roster).find(id => !col[id]); })()')
    if one:
        pg.locator('#plSub .pl-card[data-id="' + one + '"]').click(); pg.wait_for_timeout(300)
        print('C um só Moment (' + one + '):', pg.locator('#sheetPanel .note').first.inner_text().replace('\n', ' | ')[:300] if pg.locator('#sheetPanel .note').count() else '-')
        pg.click('#sheetPanel button[data-action="close-sheet"]')
    pg.click('#meBtn'); pg.wait_for_timeout(400)
    pg.click('#tab-ajustes button[data-action="sm-add"]'); pg.wait_for_timeout(200)
    pg.fill('#smTs1', 'segunda'); pg.fill('#smFlow1', '0x123')
    pg.click('#pfForm button[type="submit"]'); pg.wait_for_timeout(400)
    print('C endereço inválido:', pg.locator('#toast').inner_text())
    pg.fill('#smFlow1', '0x0000000000000b02'); pg.click('#pfForm button[type="submit"]'); pg.wait_for_timeout(2500)
    print('C smurfs guardadas:', store(pg, '__FAKE_DB.tables.profiles.find(p => p.user_id === "u-eu").smurfs'))
    pg.screenshot(path=str(shots / 'smurf-ajustes.png'), full_page=True)
    print('C largura:', width(pg))
    # procura de um plano melhor em segundo plano: não muda nada sozinha, mostra a sugestão na Jornada
    pg.click('#t-hoje'); pg.wait_for_timeout(300)
    try:
        pg.wait_for_function('() => !!window.FB_IMP', timeout=150000); pg.wait_for_timeout(500)
        print('C procura de plano melhor:', pg.evaluate('JSON.stringify(window.FB_IMP)'), '· cartão:', pg.locator('#tab-hoje .card.better').count(), '· plano mudou sozinho:', store(pg, '!!(__FAKE_DB.tables.user_runs[0].plan || {}).hint'))
        if pg.locator('#tab-hoje .card.better').count():
            print('C plano melhor (cartão):', pg.locator('#tab-hoje .card.better').inner_text().replace('\n', ' | ')[:300])
            pg.click('#tab-hoje button[data-action="better-use"]'); pg.wait_for_timeout(6000)
            print('C usar o plano melhor:', pg.locator('#toast').inner_text(), '· guardado:', store(pg, '__FAKE_DB.tables.user_runs.filter(r => r.plan && r.plan.hint).map(r => r.user_id + "/" + r.run_id)'), '· cartão:', pg.locator('#tab-hoje .card.better').count())
    except Exception as e:
        print('C procura de plano melhor: não correu em 150 s')
    pg.close()

    # ---------- D: admin apaga as runs de teste ----------
    db = seeded(); T = db['tables']
    T['runs'][0]['fictitious'] = False
    import time as _t
    T['chain_runs'].insert(0, {'id': 'cr-nova', 'name': 'Classic - Run 2 - NBA 2026-27 Season', 'run_start': int(_t.time()) - 3600, 'run_end': int(_t.time()) + 10 * 86400})
    for k in ('teste-261015', 'teste-261016'):
        T['runs'].append({'id': k, 'name': 'Run de teste', 'mode': 'classic', 'start_date': '2026-10-15', 'end_date': '2026-10-25', 'prizes': [], 'active': False, 'fictitious': True})
        T['run_days'].append({'run_id': k, 'date': '2026-10-16', 'objectives': [{'stat': 'pts', 'target': 120}], 'games': [], 'chain_game_id': None})
    pg = new_page(b, db)
    pg.on('dialog', lambda d: d.accept())
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'amigo@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(1500)
    pg.click('#meBtn'); pg.wait_for_timeout(400)
    pg.click('#tab-ajustes button[data-action="sub"][data-sub="admin"]'); pg.wait_for_timeout(300)
    print('D sem botão para criar runs de teste:', pg.locator('#tab-ajustes button[data-action="test-run"]').count() == 0)
    pg.click('#tab-ajustes button[data-action="del-tests"]'); pg.wait_for_timeout(2000)
    print('D depois de apagar:', store(pg, '__FAKE_DB.tables.runs.map(r => r.id)'), '· botão:', pg.locator('#tab-ajustes button[data-action="del-tests"]').count())
    imp = pg.locator('#tab-ajustes .card').filter(has_text='por importar')
    print('D runs por importar:', imp.inner_text().replace('\n', ' | ')[:200] if imp.count() else 'nenhuma')
    if imp.count():
        imp.locator('button[data-action="chain-import"]').first.click(); pg.wait_for_timeout(2500)
        print('D run importada:', store(pg, '(() => { const r = __FAKE_DB.tables.runs.find(x => x.chain_run_id === "cr-nova") || {}; return { id: r.id, nome: r.name, ativa: r.active, dias: __FAKE_DB.tables.run_days.filter(d => d.run_id === r.id).length, outras_ativas: __FAKE_DB.tables.runs.filter(x => x.active).length }; })()'))
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
    now_iso = '2026-10-20T14:30:00Z'
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
    pg.clock.set_fixed_time('2026-10-20T15:00:00Z')  # dia 1, antes dos jogos
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(2500)
    print('E lineup dia 1:', ' / '.join(lineup_card(pg).locator('.row .nm').all_inner_texts()))
    pg.wait_for_timeout(5000)
    print('E a fazer:', pg.locator('#tab-hoje .todo').inner_text().replace('\n', ' | ')[:300] if pg.locator('#tab-hoje .todo').count() else 'nada')
    if pg.locator('#tab-hoje button[data-action="fold"][data-k="jogos"][aria-expanded="false"]').count(): pg.click('#tab-hoje button[data-action="fold"][data-k="jogos"]'); pg.wait_for_timeout(300)
    gc = pg.locator('#tab-hoje .card').filter(has=pg.locator('.gcard'))
    if gc.count(): gc.first.screenshot(path=str(shots / 'jogos-de-hoje.png'))  # só quem joga hoje: já não há lista para abrir
    print('E jogos de hoje:', gc.first.inner_text().replace('\n', ' | ')[:240] if gc.count() else 'ERRO sem cartão', '· caras:', gc.first.locator('.face').count() if gc.count() else 0)
    rk = lineup_card(pg).locator('.row').filter(has=pg.locator('.pill.risk'))
    print('E dia a dia no lineup:', rk.inner_text().replace('\n', ' ')[:160] if rk.count() else 'ERRO sem ⚠', '· ok' if rk.count() and 'se não jogar' in rk.inner_text() else '· ERRO')
    pg.click('#tab-hoje button[data-action="opcoes"]'); wait_opcoes(pg, 120000)
    tt = pg.locator('#sheetPanel .op-card h2').all_inner_texts()
    print('E sugestões com dúvida:', ' | '.join(tt), '·', ' / '.join(pg.locator('#sheetPanel .op-card .c-warn').all_inner_texts())[:120], '· ok' if any('Sem riscos' in t for t in tt) else '· ERRO sem alternativa sem riscos')
    pg.click('#sheetPanel button[data-action="close-sheet"]'); pg.wait_for_timeout(300)
    print('E lesões e forma (fechado):', pg.locator('#tab-hoje .card').filter(has_text='Lesões e forma').inner_text().replace('\n', ' | ')[:200])
    pg.click('#tab-hoje button[data-action="fold"][data-k="lesoes"]'); pg.wait_for_timeout(300)
    print('E lesões e forma:', pg.locator('#tab-hoje .card').filter(has_text='Lesões e forma').inner_text().replace('\n', ' | ')[:400])
    # Jornada: faixa com os dias da run; um dia mais à frente mostra a previsão do plano para esse dia
    print('E faixa dos dias:', ' · '.join(x.replace('\n', ' ') for x in pg.locator('#tab-hoje .day-strip .ds').all_inner_texts()), '· com lesão:', pg.locator('#tab-hoje .ds .ds-inj').count())
    pg.locator('#tab-hoje .day-strip .ds').nth(3).click(); pg.wait_for_timeout(300)
    print('E dia 4:', pg.locator('.hero').inner_text().replace('\n', ' | ')[:220], '· opções:', pg.locator('#tab-hoje button[data-action="opcoes"]').count(), '· a fazer:', pg.locator('#tab-hoje .todo').count(),
          '· jogos:', pg.locator('#tab-hoje .card h2').filter(has_text='Jogos').all_inner_texts())
    print('E dia 4 lesões:', pg.locator('#tab-hoje .card').filter(has_text='Lesões e forma').inner_text().replace('\n', ' | ')[:300] if pg.locator('#tab-hoje .card').filter(has_text='Lesões e forma').count() else '-')
    pg.click('#tab-hoje button[data-action="sub"][data-sub="porque"]'); pg.wait_for_timeout(300)
    print('E dia 4 porquê:', pg.locator('#tab-hoje .basis-day .list-head').first.inner_text().replace('\n', ' '), '·', pg.locator('#tab-hoje .basis-day .pv .u').first.inner_text() if pg.locator('#tab-hoje .basis-day .pv .u').count() else '-')
    pg.click('#tab-hoje button[data-action="sub"][data-sub="lineup"]'); pg.wait_for_timeout(200)
    pg.screenshot(path=str(shots / 'jornada-dia4.png'), full_page=True)
    pg.click('#t-hoje'); pg.wait_for_timeout(300)
    print('E tocar em Jornada volta ao próximo dia:', pg.locator('.hero .eyebrow').inner_text(), '·', pg.locator('#tab-hoje .ds[aria-pressed="true"]').inner_text().replace('\n', ' '))
    for _ in range(60):
        if pg.locator('#tab-hoje .card').filter(has_text='Melhores compras').count(): break
        pg.wait_for_timeout(500)
    buy = pg.locator('#tab-hoje .card').filter(has_text='Melhores compras')
    print('E melhores compras (Jornada):', buy.inner_text().replace('\n', ' | ')[:300] if buy.count() else 'nenhuma', '· fotos:', buy.locator('.face').count() if buy.count() else 0)
    pg.screenshot(path=str(shots / 'hoje-completo.png'), full_page=True)
    pg.click('#t-run'); pg.wait_for_timeout(500)
    print('E run prémios:', ' // '.join(x.replace('\n', ' | ')[:250] for x in pg.locator('#tab-run .card').all_inner_texts()[:2]))
    pg.screenshot(path=str(shots / 'run-premios-2.png'), full_page=True)
    print('E run sem compras (uma casa só, Comprar):', pg.locator('#tab-run button[data-action="buy-open"]').count() == 0)
    pg.click('#t-hoje'); pg.wait_for_timeout(400)
    if pg.locator('#tab-hoje .buy-more-link').count():
        pg.locator('#tab-hoje .buy-more-link').first.click(); pg.wait_for_timeout(500)
        print('E abrir melhor compra:', pg.locator('#plSubBar button[aria-selected="true"]').inner_text(), '·', pg.locator('#plSub .card').first.inner_text().replace('\n', ' | ')[:200])
        pg.click('#t-hoje'); pg.wait_for_timeout(400)
    print('E linhas com lesão:', ' / '.join(x.replace('\n', ' ') for x in pg.locator('#tab-hoje .row').filter(has=pg.locator('.pill.duv, .pill.fora, .pill.dout')).all_inner_texts())[:300])
    pg.click('#tab-hoje button[data-action="sub"][data-sub="porque"]'); pg.wait_for_timeout(300); 
    print('E em que se baseia:', pg.locator('#tab-hoje .basis-day').inner_text().replace('\n', ' | ')[:900])
    pg.screenshot(path=str(shots / 'hoje-baseia.png'), full_page=True)
    print('E próximos lineups publicados:', store(pg, 'Object.keys((__FAKE_DB.tables.user_runs[0].plan.next || {}).main || {})'))
    pg.locator('#tab-hoje .basis-day button[data-action="player"]').first.click(); pg.wait_for_timeout(300)
    print('E ficha (partes):', ' | '.join(pg.locator('#sheetPanel .ptabs button').all_inner_texts()), '· resumo visível:', pg.locator('#sheetPanel .ptab[data-ptab="res"]').is_visible(), '· foto:', pg.locator('#sheetPanel .face').count())
    pg.click('#sheetPanel button[data-action="ptab"][data-v="porque"]'); pg.wait_for_timeout(200)
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
    print('E sem botão Acertar usos:', pg.locator('#plSub button[data-action="uses-sheet"]').count() == 0)
    pg.fill('#rosterFilter', 'lebron'); pg.wait_for_timeout(300)
    pg.locator('#plBody .pl-card').first.click(); pg.wait_for_timeout(300)
    pg.locator('#sheetPanel button[data-action="uses"][data-d="1"]').first.click(); pg.wait_for_timeout(150)
    pg.locator('#sheetPanel button[data-action="uses"][data-d="1"]').first.click(); pg.wait_for_timeout(2500)
    print('E usos na ficha (LeBron):', store(pg, '__FAKE_DB.tables.user_runs[0].roster.lebron'), '· mostrado:', pg.locator('#sheetPanel output').first.inner_text())
    pg.screenshot(path=str(shots / 'ficha-usos.png'))
    pg.click('#sheetPanel button[data-action="close-sheet"]')
    pg.fill('#rosterFilter', ''); pg.wait_for_timeout(300)
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
    pg.locator('#plSub button[data-action="forma-day"]').nth(1).click(); pg.wait_for_timeout(300)
    print('E forma (dia 2):', pg.locator('#plSub .frow').count(), 'linhas ·', (pg.locator('#plSub .frow').first.inner_text().replace('\n', ' | ') if pg.locator('#plSub .frow').count() else ''))
    if pg.locator('#plSub .frow').count():
        pg.locator('#plSub .frow').last.click(); pg.wait_for_timeout(300)
        print('E ficha da forma:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:200]); pg.click('#sheetPanel button[data-action="close-sheet"]')
    pg.click('#meBtn'); pg.wait_for_timeout(400)
    print('E ajustes sem avisos (desligados por agora):', pg.locator('#tab-ajustes h2').all_inner_texts() if pg.click('#meBtn') is None and pg.wait_for_timeout(400) is None else '')
    pg.click('#t-plantel'); pg.wait_for_timeout(300); pg.click('#tab-plantel button[data-action="sub"][data-sub="comprar"]'); pg.wait_for_timeout(300); 
    t0 = __import__('time').time()
    pg.click('#plSub button[data-action="buy-run"]'); pg.wait_for_timeout(300); pg.wait_for_selector('#buyProg', state='detached', timeout=90000)
    print('E compras (%.1f s):' % (__import__('time').time() - t0), ' // '.join(x.replace('\n', ' | ')[:330] for x in pg.locator('#buyOut .card').all_inner_texts()[:3]))
    nb = pg.locator('#buyOut .buy-row').count()
    print('E compras, resumo:', pg.locator('#buyOut .buy-intro').inner_text() if pg.locator('#buyOut .buy-intro').count() else 'ERRO sem resumo', '· botão:', pg.locator('#buyOut button[data-action="buy-more"]').inner_text() if pg.locator('#buyOut button[data-action="buy-more"]').count() else 'sem mais')
    if pg.locator('#buyOut button[data-action="buy-more"]').count():
        pg.click('#buyOut button[data-action="buy-more"]'); pg.wait_for_timeout(300); pg.wait_for_selector('#buyMoreProg', state='detached', timeout=90000); pg.wait_for_timeout(200)
        print('E testar mais:', nb, '→', pg.locator('#buyOut .buy-row').count(), '·', pg.locator('#buyOut .buy-intro').inner_text(), '· ok' if pg.locator('#buyOut .buy-row').count() > nb else '· ERRO')
    pg.screenshot(path=str(shots / 'compras.png'), full_page=True)
    pg.fill('#buySearch', 'Curry'); pg.wait_for_timeout(200)
    pg.click('#buyFound button[data-action="buy-pick"]'); pg.wait_for_timeout(300); pg.wait_for_selector('#buyProg', state='detached', timeout=90000)
    print('E avaliar Curry:', pg.locator('#buyOut').inner_text().replace('\n', ' | ')[:400])
    pg.click('#plSub button[data-action="buy-mode"][data-mode="more"]'); pg.wait_for_timeout(200)
    pg.click('#plSub button[data-action="buy-run"]'); pg.wait_for_timeout(300); pg.wait_for_selector('#buyProg', state='detached', timeout=90000)
    print('E mais usos:', ' // '.join(x.replace('\n', ' | ')[:200] for x in pg.locator('#buyOut .card').all_inner_texts()[:2]))
    pg.click('#t-grupo'); pg.wait_for_timeout(600)
    print('E grupo:', ' // '.join(pg.locator('#tab-grupo .gc tbody tr').all_inner_texts()).replace('\n', ' ')[:300])
    pg.screenshot(path=str(shots / 'grupo-aros.png'), full_page=True)
    print('E largura:', width(pg))
    # folhas: × sempre em cima à direita; ‹ quando há folha anterior; o voltar do telemóvel volta/fecha sem sair da app
    sheet_t = lambda: pg.locator('#sheetPanel h3').first.inner_text() if pg.evaluate('!document.getElementById("sheet").hidden') else '(fechada)'
    pg.click('#t-hoje'); pg.wait_for_timeout(300); pg.click('#tab-hoje button[data-action="sub"][data-sub="lineup"]'); pg.wait_for_timeout(300)
    pg.locator('#tab-hoje .list button[data-action="player"]').first.click(); pg.wait_for_timeout(400)
    print('E folha (× / ‹):', pg.locator('#sheetPanel .sheet-bar [data-action="close-sheet"]').count(), '/', pg.locator('#sheetPanel .sheet-bar [data-action="sheet-back"]').count())
    if pg.locator('#sheetPanel button[data-action="ptab"][data-v="res"]').count(): pg.click('#sheetPanel button[data-action="ptab"][data-v="res"]'); pg.wait_for_timeout(200)
    pg.click('#sheetPanel button[data-action="ban"]'); pg.wait_for_function("() => !document.getElementById('choiceProg')", timeout=60000); pg.wait_for_timeout(200)
    pg.click('#sheetPanel .sheet-bar [data-action="sheet-back"]'); pg.wait_for_timeout(300)
    print('E ‹ volta à ficha:', sheet_t())
    pg.click('#sheetPanel button[data-action="ban"]'); pg.wait_for_function("() => !document.getElementById('choiceProg')", timeout=60000); pg.wait_for_timeout(200)
    pg.go_back(); pg.wait_for_timeout(400); print('E voltar do telemóvel 1:', sheet_t())
    pg.go_back(); pg.wait_for_timeout(400); print('E voltar do telemóvel 2:', sheet_t(), '· na app:', pg.url, pg.evaluate('!document.getElementById("app").hidden'))
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
    pg.wait_for_function('() => { const l = (__FAKE_DB.tables.user_runs[0].plan || {}).live; return l && Object.values(l)[0] && Object.values(l)[0].active; }', timeout=15000); pg.wait_for_timeout(2500)
    print('F lineup ao vivo:', ' / '.join(x.replace('\n', ' ') for x in lineup_card(pg).locator('.row').all_inner_texts()))
    print('F ao vivo (sozinho):', store(pg, 'Object.values((__FAKE_DB.tables.user_runs[0].plan.live)||{})[0]?.players || null'))
    print('F jogos de hoje (ao vivo):', pg.locator('#tab-hoje .card').filter(has_text='Jogos de hoje').inner_text().replace('\n', ' | ')[:400])
    pg.screenshot(path=str(shots / 'ao-vivo.png'), full_page=True)
    # Opções para hoje durante os jogos: com o que já aconteceu, manter / tirar um / poupar os que faltam
    print('F botão opções:', pg.locator('#tab-hoje .hero button[data-action="opcoes"]').count())
    pg.locator('#tab-hoje .hero button[data-action="opcoes"]').click(); pg.wait_for_timeout(600)
    print('F opções (logo):', pg.locator('#opHead').inner_text().replace('\n', ' | ')[:300], '·', pg.locator('#opCards').inner_text().replace('\n', ' ')[:80])
    wait_opcoes(pg)
    print('F opções ao vivo:', ' // '.join(x.replace('\n', ' | ')[:200] for x in pg.locator('#sheetPanel .op-card').all_inner_texts()))
    print('F lineup submetido:', ' / '.join(pg.locator('#sheetPanel .chips button[aria-pressed="true"]').all_inner_texts()))
    pg.screenshot(path=str(shots / 'opcoes-ao-vivo.png'))
    if pg.locator('#sheetPanel button[data-action="op-use"]').count():
        pg.locator('#sheetPanel button[data-action="op-use"]').last.click(); pg.wait_for_timeout(1500)
        print('F escolha aplicada:', pg.locator('#toast').inner_text(), '· sugestão:', pg.locator('#tab-hoje .note.sug').inner_text().replace('\n', ' | ')[:200] if pg.locator('#tab-hoje .note.sug').count() else 'sem sugestão')
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
    pg.locator('#tab-run button[data-action="day"]').first.click(); pg.wait_for_timeout(400)
    print('G dia fechado (na Jornada):', pg.locator('#tab-hoje .ds[aria-pressed="true"]').inner_text().replace('\n', ' '), '·', ' // '.join(x.replace('\n', ' | ')[:300] for x in pg.locator('#tab-hoje .card').all_inner_texts()[1:2]))
    pg.screenshot(path=str(shots / 'dia-previsto-real.png'), full_page=True)
    pg.click('#t-run'); pg.wait_for_timeout(300)
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
    pg.click('#meBtn'); pg.wait_for_timeout(300)
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
    pg.click('#meBtn'); pg.wait_for_timeout(300)
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
    print('H hoje:', pg.locator('.hero .jc-txt, .hero .hero-top').first.inner_text().replace('\n', ' | ')[:80])
    print('H a fazer:', pg.locator('#tab-hoje .todo').inner_text().replace('\n', ' | ')[:300] if pg.locator('#tab-hoje .todo').count() else 'nada')
    gc = pg.locator('#tab-hoje .card').filter(has_text='Jogos de hoje')
    print('H jogos de hoje:', gc.inner_text().replace('\n', ' | ')[:300] if gc.count() else 'sem cartão')
    lineup_teams = lineup_card(pg).locator('.row .ps').all_inner_texts()
    day3 = [g[:2] for g in run['days'][2]['games']]; teams3 = set(t for g in day3 for t in g)
    print('H lineup só com quem joga hoje:', all(any(t in x for t in teams3) for x in lineup_teams), len(lineup_teams))
    pg.screenshot(path=str(shots / 'hoje-dia3.png'), full_page=True)
    print('H faixa (antes):', ' · '.join(x.replace('\n', ' ') for x in pg.locator('#tab-hoje .day-strip .ds').all_inner_texts()[:3]))
    pg.locator('#tab-hoje .todo button[data-action="past-lu"]').first.click(); pg.wait_for_timeout(300)
    print('H registar dia 1 (A fazer):', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:200])
    for _ in range(5): pg.locator('#sheetPanel .lu-ic.add[data-action="past-lu-pick"]').first.click(); pg.wait_for_timeout(120)
    pg.click('#sheetPanel button[data-action="past-lu-save"]'); pg.wait_for_timeout(1500)
    print('H dia 1 registado:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.played'), '·', pg.locator('#runMeta').inner_text())
    print('H faixa:', ' · '.join(x.replace('\n', ' ') for x in pg.locator('#tab-hoje .day-strip .ds').all_inner_texts()[:5]))
    pg.locator('#tab-hoje .day-strip .ds').nth(0).click(); pg.wait_for_timeout(300)
    print('H dia 1 (passado):', pg.locator('.hero').inner_text().replace('\n', ' | ')[:160], '·', pg.locator('#tab-hoje button[data-action="past-lu"]').inner_text())
    pg.locator('#tab-hoje .day-strip .ds').nth(1).click(); pg.wait_for_timeout(300)
    print('H dia 2 (sem resultado):', pg.locator('.hero').inner_text().replace('\n', ' | ')[:160], '·', pg.locator('#tab-hoje button[data-action="past-lu"]').inner_text())
    pg.screenshot(path=str(shots / 'jornada-passado.png'), full_page=True)
    pg.click('#t-hoje'); pg.wait_for_timeout(300)
    jg = pg.locator('#tab-hoje .card').filter(has=pg.locator('button[data-k="jogosdia"]'))
    print('H jogos do dia 3:', jg.first.inner_text().replace('\n', ' | ')[:300] if jg.count() else 'sem cartão')
    pg.close()

    # ---------- K: os dias fecham sozinhos com as fichas dos jogos (ESPN), sem registar à mão ----------
    ESPN_AB = {'NYK': 'NY', 'SAS': 'SA', 'GSW': 'GS', 'UTA': 'UTAH', 'WAS': 'WSH', 'NOP': 'NO'}
    KEYS = ['minutes', 'points', 'fieldGoalsMade-fieldGoalsAttempted', 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', 'freeThrowsMade-freeThrowsAttempted', 'rebounds', 'assists', 'turnovers', 'steals', 'blocks', 'offensiveRebounds', 'defensiveRebounds', 'fouls', 'plusMinus']
    LABELS = ['MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'STL', 'BLK', 'OREB', 'DREB', 'PF', '+/-']
    def ath(name, pts, fg3='1-4', reb=5, dnp=False):
        if dnp: return {'athlete': {'displayName': name}, 'didNotPlay': True, 'reason': "COACH'S DECISION", 'stats': []}
        return {'athlete': {'displayName': name}, 'stats': ['30', str(pts), '8-17', fg3, '3-4', str(reb), '4', '2', '1', '0', '1', str(reb - 1), '2', '+3']}
    g_by_id, g_by_date = {}, {}
    for i_, d_ in enumerate(run['days']):
        for j_, g_ in enumerate(d_['games']):
            gid_ = '4019%05d' % (i_ * 20 + j_ + 1); g_by_id[gid_] = g_; g_by_date.setdefault(d_['date'].replace('-', ''), []).append((gid_, g_))
    def k_route(lines, calls):
        # placar e fichas como os da ESPN (siglas NY, SA…; 5 suplentes em cada equipa; jogos acabados)
        def h(r):
            url = r.request.url; hdr = {'access-control-allow-origin': '*'}; calls.append(url.split('/nba/')[1])
            if 'scoreboard' in url:
                evs = [{'id': gid, 'date': g[2], 'status': {'type': {'state': 'post', 'shortDetail': 'Final', 'completed': True}, 'period': 4},
                        'competitions': [{'competitors': [{'homeAway': 'away', 'team': {'abbreviation': ESPN_AB.get(g[0], g[0])}, 'score': '104'}, {'homeAway': 'home', 'team': {'abbreviation': ESPN_AB.get(g[1], g[1])}, 'score': '116'}]}]}
                       for gid, g in g_by_date.get(url.split('dates=')[1][:8], [])]
                return r.fulfill(status=200, content_type='application/json', headers=hdr, body=json.dumps({'events': evs}))
            if 'event=' not in url: return r.fulfill(status=200, content_type='application/json', headers=hdr, body='{}')  # plantéis (fotos): nada
            g = g_by_id[url.split('event=')[1][:9]]
            teams = [{'team': {'abbreviation': ESPN_AB.get(t, t)}, 'statistics': [{'keys': KEYS, 'labels': LABELS, 'athletes': lines.get(t, []) + [ath('Suplente %s %d' % (t, k), 2 + k) for k in range(5)]}]} for t in g[:2]]
            return r.fulfill(status=200, content_type='application/json', headers=hdr, body=json.dumps({'header': {'competitions': [{'status': {'type': {'state': 'post', 'completed': True}}}]}, 'boxscore': {'players': teams}}))
        return h
    seedK = json.loads((root / 'data' / 'seed' / 'runs' / 'run-1-classic-2026-27.json').read_text())
    d1, d2 = run['days'][0]['date'], run['days'][1]['date']
    lu1 = ['sga', 'brunson', 'wemby', 'cade', 'maxey']
    def k_db(plan, uses):
        db = seeded(); T = db['tables']
        T['runs'][0]['fictitious'] = False
        for i_, d_ in enumerate(T['run_days']): d_['objectives'] = seedK['days'][i_]['objectives']  # dia 1: 120 PTS; dia 2: 18 3PM + 30 3PA
        T['members'].append({'user_id': 'u-eu', 'role': 'member'})
        T['profiles'].append({'user_id': 'u-eu', 'display_name': 'João', 'topshot_username': 'gandapanasco'})
        T['user_runs'] = [{'user_id': 'u-eu', 'run_id': 'run-1', 'roster': {pid: {'uses': uses.get(pid, 2), 'status': 'ok'} for pid in list(roster['players'])[:16]}, 'plan': plan, 'updated_at': '2026-10-21T08:00:00Z'}]
        T['chain_results'] = []; T['injuries'] = []
        return db
    # K1 (o caso do utilizador): dia 1 registado à mão como derrota; o ao vivo só leu o 1.º jogo (Cade) e o Maxey a meio;
    # os outros jogos acabaram com a app fechada. Ao abrir de manhã, lê as fichas que faltam e completa o dia.
    pl1 = {'sga': [[29.5], 7, 'o', 0, 1], 'brunson': [[26.0], 6.8, 'o', 0, 1], 'wemby': [[26.1], 7, 'o', 0, 1], 'cade': [[24.0], 6.5, 'o', 0, 1], 'maxey': [[26.4], 7, 'o', 0, 1], 'kat': [[20.0], 6, 'a', 0, 1], 'lebron': [[21.0], 6, 'a', 1, 1]}
    plan1 = {'proj': {d1: {'P': 0.76, 'lineup': lu1, 'o': [{'stat': 'pts', 'T': 120, 'mu': 132, 'sd': 18}], 'pl': pl1, 'at': '2026-10-20T18:35:00Z'}},
             'live': {d1: {'active': True, 'lineup': lu1, 'players': {'cade': {'state': 'fim', 'vals': {'pts': 22}}, 'maxey': {'state': 'jogo', 'q': 3, 'vals': {'pts': 15}}}}},
             'played': {d1: {'done': True, 'result': 'loss', 'lineup': lu1}}}
    calls = []
    pg = new_page(b, k_db(plan1, {pid: 1 for pid in lu1}))
    pg.route('https://site.api.espn.com/**', k_route({'OKC': [ath('Shai Gilgeous-Alexander', 35), ath('Chet Holmgren', 0, dnp=True)], 'SAS': [ath('Victor Wembanyama', 12)],
        'NYK': [ath('Jalen Brunson', 21), ath('Karl-Anthony Towns', 19)], 'PHI': [ath('Tyrese Maxey', 28), ath('LeBron James', 14)], 'DET': [ath('Cade Cunningham', 22)]}, calls))
    pg.clock.set_fixed_time('2026-10-21T08:10:00Z')  # 9:10 em Lisboa: os jogos do dia 1 acabaram de madrugada
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit')
    pg.wait_for_function('() => ((__FAKE_DB.tables.user_runs[0].plan.played || {})["%s"] || {}).box' % d1, timeout=15000); pg.wait_for_timeout(800)
    print('K1 dia 1 completo:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.played["%s"]' % d1), '· reais:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.proj["%s"].act' % d1))
    print('K1 usos (sem descontar outra vez):', store(pg, 'Object.fromEntries(%s.map(id => [id, __FAKE_DB.tables.user_runs[0].roster[id].uses]))' % json.dumps(lu1)), '· pedidos à ESPN:', sorted(set(calls)))
    pg.locator('#tab-hoje .day-strip .ds').nth(0).click(); pg.wait_for_timeout(600)
    print('K1 dia 1 (Jornada):', pg.locator('.hero').inner_text().replace('\n', ' | ')[:200])
    pva = pg.locator('#tab-hoje .card').filter(has_text='Previsto vs real')
    print('K1 previsto vs real:', pva.inner_text().replace('\n', ' | ')[:420])
    print('K1 jogos do dia:', pg.locator('#tab-hoje .card').filter(has=pg.locator('h2', has_text='Jogos do dia')).inner_text().replace('\n', ' | ')[:300])
    pg.screenshot(path=str(shots / 'dia-fechado-estatisticas.png'), full_page=True)
    # mudar os jogadores (folha igual à do lineup da Jornada): o que cada um fez nesse dia e o resultado
    pg.click('#tab-hoje button[data-action="past-lu"]'); pg.wait_for_timeout(600)
    print('K1 folha (dia fechado):', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:360])
    pg.screenshot(path=str(shots / 'mudar-jogadores.png'))
    pg.click('#sheetPanel button[data-action="close-sheet"]'); pg.wait_for_timeout(200)
    print('K1 aviso:', ' / '.join(pg.locator('#tab-hoje .note').all_inner_texts())[:200], '·', pg.locator('.hero .hero-top').inner_text().replace('\n', ' '))
    pg.click('#t-run'); pg.wait_for_timeout(300); pg.click('#tab-run button[data-action="sub"][data-sub="dias"]'); pg.wait_for_timeout(400)
    print('K1 run → dias:', ' // '.join(x.replace('\n', ' ') for x in pg.locator('#tab-run .drow').all_inner_texts()[:4]), '·', pg.locator('#tab-run .drow').count(), 'dias')
    pg.screenshot(path=str(shots / 'run-dias.png'), full_page=True)
    pg.locator('#tab-run .drow').nth(2).click(); pg.wait_for_timeout(400)
    print('K1 tocar no dia 3:', pg.locator('#t-hoje').get_attribute('aria-selected'), pg.locator('#tab-hoje .ds[aria-pressed="true"]').inner_text().replace('\n', ' '))
    print('K1 largura:', width(pg))
    pg.close()
    # K2: dia 2 (3PM + 3PA) sem nada registado e sem ao vivo (app fechada durante os jogos): fecha sozinho com o lineup
    # guardado antes do 1.º jogo, desconta os usos; "Não joguei" desfaz e não volta a fechar
    lu2 = ['curry', 'luka', 'ant', 'mitchell', 'jokic']
    plan2 = {'proj': {d2: {'P': 0.55, 'lineup': lu2, 'o': [{'stat': 'fg3', 'T': 18, 'mu': 17.1, 'sd': 3.9}, {'stat': 'fg3a', 'T': 30, 'mu': 41, 'sd': 6}], 'pl': {pid: [[3.5, 9], 1.8, 'o', 0, 1] for pid in lu2}, 'at': '2026-10-21T22:40:00Z'}},
             'played': {d1: {'done': True, 'result': 'loss', 'lineup': lu1, 'box': True, 'points': 118, 'tot': [118]}}}
    calls = []
    pg = new_page(b, k_db(plan2, {pid: 1 for pid in lu1}))
    pg.route('https://site.api.espn.com/**', k_route({'GSW': [ath('Stephen Curry', 30, '7-14')], 'LAL': [ath('Luka Dončić', 33, '5-11')], 'MIN': [ath('Anthony Edwards', 27, '4-9')], 'CLE': [ath('Donovan Mitchell', 25, '2-6')], 'DEN': [ath('Nikola Jokić', 26, '1-2')]}, calls))
    pg.clock.set_fixed_time('2026-10-22T08:30:00Z')
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit')
    pg.wait_for_function('() => ((__FAKE_DB.tables.user_runs[0].plan.played || {})["%s"] || {}).done' % d2, timeout=15000); pg.wait_for_timeout(300)
    print('K2 aviso:', pg.locator('#toast').inner_text())
    print('K2 dia 2 fechado sozinho:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.played["%s"]' % d2), '· usos:', store(pg, 'Object.fromEntries(%s.map(id => [id, __FAKE_DB.tables.user_runs[0].roster[id].uses]))' % json.dumps(lu2)))
    print('K2 pedidos à ESPN:', len([c for c in calls if 'summary' in c]), 'fichas ·', len([c for c in calls if 'scoreboard' in c]), 'placares')
    pg.wait_for_timeout(700)
    print('K2 cabeçalho:', pg.locator('#runMeta').inner_text(), '· faixa:', ' · '.join(x.replace('\n', ' ') for x in pg.locator('#tab-hoje .day-strip .ds').all_inner_texts()[:3]))
    pg.locator('#tab-hoje .day-strip .ds').nth(1).click(); pg.wait_for_timeout(500)
    print('K2 dia 2:', pg.locator('.hero').inner_text().replace('\n', ' | ')[:200])
    # mudar os jogadores do dia (o lineup que foi mesmo submetido): sai o Jokić, entra outro; resultado refeito
    pg.click('#tab-hoje button[data-action="past-lu"]'); pg.wait_for_timeout(300)
    pg.click('#sheetPanel button[data-action="past-lu-pick"][data-id="jokic"]'); pg.wait_for_timeout(150)
    other = pg.locator('#sheetPanel .lu-ic.add[data-action="past-lu-pick"]').first
    print('K2 mudar jogadores:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:200], '· entra:', other.get_attribute('data-id'))
    other.click(); pg.wait_for_timeout(150); pg.click('#sheetPanel button[data-action="past-lu-save"]'); pg.wait_for_timeout(1500)
    print('K2 lineup mudado:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.played["%s"]' % d2), '· aviso:', pg.locator('#toast').inner_text())
    pg.click('#tab-hoje button[data-action="past-lu"]'); pg.wait_for_timeout(300)
    pg.click('#sheetPanel button[data-action="undo-result"]'); pg.wait_for_timeout(2500)
    print('K2 não joguei:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.played["%s"]' % d2), '· usos:', store(pg, '%s.map(id => __FAKE_DB.tables.user_runs[0].roster[id].uses)' % json.dumps(lu2)), '·', pg.locator('.hero .hero-top').inner_text().replace('\n', ' '))
    pg.close()
    # K4: quem começa a usar o site a meio da run: o dia 1 não tem lineup nem resultado; escolhe os jogadores e o dia fecha
    calls = []
    pg = new_page(b, k_db({}, {}))
    pg.route('https://site.api.espn.com/**', k_route({'OKC': [ath('Shai Gilgeous-Alexander', 35)], 'SAS': [ath('Victor Wembanyama', 12)], 'NYK': [ath('Jalen Brunson', 21)], 'PHI': [ath('Tyrese Maxey', 28)], 'DET': [ath('Cade Cunningham', 22)]}, calls))
    pg.clock.set_fixed_time('2026-10-22T08:30:00Z')
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(1500)
    pg.locator('#tab-hoje .day-strip .ds').nth(0).click(); pg.wait_for_timeout(500)
    print('K4 dia 1 sem nada:', pg.locator('.hero').inner_text().replace('\n', ' | ')[:120], '· botões:', ' / '.join(pg.locator('#tab-hoje .ctr-btn button').all_inner_texts()))
    pg.click('#tab-hoje button[data-action="past-lu"]'); pg.wait_for_timeout(300)
    for pid in lu1: pg.click('#sheetPanel button[data-action="past-lu-pick"][data-id="%s"]' % pid); pg.wait_for_timeout(80)
    pg.click('#sheetPanel button[data-action="past-lu-save"]'); pg.wait_for_timeout(1500)
    print('K4 dia 1 escolhido:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.played["%s"]' % d1), '· usos:', store(pg, '%s.map(id => __FAKE_DB.tables.user_runs[0].roster[id].uses)' % json.dumps(lu1)), '· aviso:', pg.locator('#toast').inner_text())
    pg.close()
    # K5: o dia 1 fechou pelas estatísticas com o lineup da app; depois a leitura do Top Shot diz que levaste outro
    # (e ganhaste): o lineup é acertado e o total refeito com as fichas desse lineup (não fica o do lineup antigo)
    import unicodedata as _ud, re
    def _tsn(n):
        n = ''.join(c for c in _ud.normalize('NFD', n) if _ud.category(c) != 'Mn').lower()
        n = re.sub(r"[.'’`]", '', n).replace('-', ' '); n = re.sub(r'\b(jr|sr|ii|iii|iv)\b', '', n); return re.sub(r'\s+', ' ', n).strip()
    A5 = 'e7fb03955ade55fa'; lu5 = ['sga', 'brunson', 'wemby', 'kat', 'lebron']
    rk5 = {'v': 1, 'sv': 14, 'do': ['ranks'], 'at': '2026-10-21T08:00:00Z', 'run': {'id': 'r1'}, 'accs': [{'a': A5, 'found': True, 'rank': 300, 'wins': 1}], 'bands': [], 'cut': {}, 'total': 2000,
           'days': [{'luv': 1, 'id': 'c1', 'date': d1, 'final': True, 'total': 2314, 'asked': [A5], 'accs': {A5: {'rank': 120, 'score': 1000600, 'won': True, 'lu': [['1', _tsn(roster['players'][x]['name'])] for x in lu5]}}}]}
    db5 = k_db({'played': {d1: {'done': True, 'result': 'loss', 'lineup': lu1, 'box': True, 'points': 118, 'tot': [118]}}}, {pid: 1 for pid in lu1})
    [x.update({'flow_address': '0x' + A5}) for x in db5['tables']['profiles'] if x['user_id'] == 'u-eu']
    calls = []
    pg = new_page(b, db5)
    pg.add_init_script("try { localStorage.setItem('fb-ranks', " + json.dumps(json.dumps(rk5)) + "); } catch (e) {}")
    pg.route('https://site.api.espn.com/**', k_route({'OKC': [ath('Shai Gilgeous-Alexander', 35)], 'SAS': [ath('Victor Wembanyama', 12)], 'NYK': [ath('Jalen Brunson', 21), ath('Karl-Anthony Towns', 40)],
        'PHI': [ath('Tyrese Maxey', 28), ath('LeBron James', 14)], 'DET': [ath('Cade Cunningham', 22)], 'LAL': [ath('LeBron James', 14)]}, calls))
    pg.clock.set_fixed_time('2026-10-21T08:30:00Z')
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit')
    try: pg.wait_for_function('() => ((__FAKE_DB.tables.user_runs[0].plan.played || {})["%s"] || {}).tot + "" !== "118"' % d1, timeout=15000)
    except Exception as e_: print('K5 sem mudança:', e_)
    pg.wait_for_timeout(2500)
    print('K5 dia 1 acertado:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.played["%s"]' % d1))
    pg.close()
    # K6: o dia 1 fechou pelas estatísticas com o lineup da app, mas o Top Shot não tem a conta na classificação do
    # dia (não levou lineup): o dia fica sem jogadores (derrota) e os usos voltam
    rk6 = {'v': 1, 'sv': 16, 'do': ['ranks'], 'at': '2026-10-21T08:00:00Z', 'run': {'id': 'r1'}, 'accs': [{'a': A5, 'found': True, 'rank': 300, 'wins': 1}], 'bands': [], 'cut': {}, 'total': 2000,
           'days': [{'id': 'c1', 'date': d1, 'final': True, 'total': 2314, 'asked': [A5], 'no': [A5], 'accs': {}}]}
    db6 = k_db({'played': {d1: {'done': True, 'result': 'win', 'lineup': lu1, 'box': True, 'points': 118, 'tot': [118]}}}, {pid: 1 for pid in lu1})
    [x.update({'flow_address': '0x' + A5}) for x in db6['tables']['profiles'] if x['user_id'] == 'u-eu']
    pg = new_page(b, db6)
    pg.add_init_script("try { localStorage.setItem('fb-ranks', " + json.dumps(json.dumps(rk6)) + "); } catch (e) {}")
    pg.route('https://site.api.espn.com/**', k_route({}, []))
    pg.clock.set_fixed_time('2026-10-21T08:30:00Z')
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit')
    try: pg.wait_for_function('() => ((__FAKE_DB.tables.user_runs[0].plan.played || {})["%s"] || {}).none' % d1, timeout=15000)
    except Exception as e_: print('K6 sem mudança:', e_)
    pg.wait_for_timeout(1500)
    print('K6 dia sem lineup:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.played["%s"]' % d1), '· usos:', store(pg, '%s.map(id => __FAKE_DB.tables.user_runs[0].roster[id].uses)' % json.dumps(lu1)))
    if pg.locator('#sheet').is_visible(): pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.locator('#tab-hoje .day-strip .ds').nth(0).click(); pg.wait_for_timeout(500)
    print('K6 dia 1:', pg.locator('#tab-hoje .hero .hero-top').inner_text().replace('\n', ' '), '·', 'Não levaste lineup' in pg.locator('#tab-hoje').inner_text())
    pg.click('#t-grupo'); pg.wait_for_timeout(800)
    print('K6 classificação:', pg.locator('#tab-grupo table.gc tbody tr.me td.c').first.inner_text())
    pg.close()
    # K6b: um dia sem lineup a que as estatísticas puseram o total do lineup sugerido: o total sai e fica 0
    db6 = k_db({'played': {d1: {'done': True, 'result': 'loss', 'lineup': [], 'ts': True, 'none': True, 'box': True, 'tot': [118], 'points': 118}}}, {pid: 2 for pid in lu1})
    [x.update({'flow_address': '0x' + A5}) for x in db6['tables']['profiles'] if x['user_id'] == 'u-eu']
    pg = new_page(b, db6)
    pg.add_init_script("try { localStorage.setItem('fb-ranks', " + json.dumps(json.dumps(rk6)) + "); } catch (e) {}")
    pg.route('https://site.api.espn.com/**', k_route({}, []))
    pg.clock.set_fixed_time('2026-10-21T08:30:00Z')
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit')
    try: pg.wait_for_function('() => !((__FAKE_DB.tables.user_runs[0].plan.played || {})["%s"] || {}).tot' % d1, timeout=15000)
    except Exception as e_: print('K6b sem mudança:', e_)
    pg.wait_for_timeout(1000)
    if pg.locator('#sheet').is_visible(): pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.locator('#tab-hoje .day-strip .ds').nth(0).click(); pg.wait_for_timeout(500)
    print('K6b total tirado:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.played["%s"]' % d1), '· feito:', pg.locator('#tab-hoje .hero .gb-n').all_inner_texts())
    pg.close()
    # M: lineup de hoje mantido. 1) o primeiro lineup do dia fica; 2) um dele fica Fora: só ele sai (aviso); 3) outro
    # passa a render muito mais: troca (aviso com +pp) e fica no histórico
    def m_login(dbm):
        p_ = new_page(b, dbm); p_.clock.set_fixed_time('2026-10-20T15:00:00Z')
        p_.goto('https://site.test/'); p_.wait_for_timeout(500)
        p_.fill('#auEmail', 'eu@x.pt'); p_.fill('#auPass', 'segredo1'); p_.click('#auSubmit'); p_.wait_for_timeout(3000)
        return p_
    HM = '__FAKE_DB.tables.user_runs[0].plan'
    dbm = seeded(); Tm = dbm['tables']; Tm['runs'][0]['fictitious'] = False
    Tm['members'].append({'user_id': 'u-eu', 'role': 'member'}); Tm['profiles'].append({'user_id': 'u-eu', 'display_name': 'João', 'topshot_username': 'gandapanasco'})
    Tm['user_runs'] = [{'user_id': 'u-eu', 'run_id': 'run-1', 'roster': {pid: {'uses': 2, 'status': 'ok'} for pid in list(roster['players'])[:16]}, 'plan': {}, 'updated_at': '2026-10-15T10:00:00Z'}]
    Tm['chain_results'] = []; Tm['injuries'] = []
    pg = m_login(dbm)
    hm1 = json.loads(store(pg, HM + '.hold'))
    print('M1 lineup do dia:', hm1['ids'], '·', [e['k'] for e in json.loads(store(pg, HM + '.lhist["' + d1 + '"]'))])
    dbm = json.loads(pg.evaluate('JSON.stringify(__FAKE_DB)')); dbm['session'] = None; pg.close()
    dbm['tables']['injuries'] = [{'id': hm1['ids'][1], 'name': hm1['ids'][1], 'team': '', 'status': 'out', 'label': 'Out', 'detail': 'Ankle', 'comment': '', 'return_date': None, 'updated_at': '2026-10-20T14:30:00Z'}]
    pg = m_login(dbm); pg.wait_for_timeout(5000)
    hm2 = json.loads(store(pg, HM + '.hold'))['ids']
    print('M2 fora:', hm1['ids'][1], '· mantêm-se', len([x for x in hm1['ids'] if x in hm2]), 'de 5 ·', json.loads(store(pg, HM + '.lhist["' + d1 + '"]'))[-1], '· aviso:', pg.locator('#sheetPanel h3').inner_text() if pg.locator('#sheet').is_visible() else 'nenhum')
    dbm = json.loads(pg.evaluate('JSON.stringify(__FAKE_DB)')); dbm['session'] = None; pg.close()
    dbm['tables']['injuries'] = []
    star_ = [x for x in list(roster['players'])[:16] if x not in hm2][0]
    for r_ in dbm['tables']['odds_days']:
        if r_['date'] == d1: r_['players'].pop(star_, None)
    for p_ in dbm['tables']['nba_players']:
        if p_['id'] == star_: p_['avg'] = dict(p_['avg'], pts=45, reb=14, ast=12, fg3=6)
    pg = m_login(dbm); pg.wait_for_timeout(8000)
    ev_ = json.loads(store(pg, HM + '.lhist["' + d1 + '"]'))[-1]
    print('M3 troca melhor:', star_, 'entra:', star_ in json.loads(store(pg, HM + '.hold'))['ids'], '·', ev_['k'], 'run +%.1f%%' % (100 * ev_.get('g', 0)), '· aviso:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:160] if pg.locator('#sheet').is_visible() else 'nenhum')
    if pg.locator('#sheet').is_visible(): pg.click('#sheetPanel button[data-action="close-sheet"]'); pg.wait_for_timeout(300)
    print('M3 linha:', pg.locator('#tab-hoje .hold-line').inner_text().replace('\n', ' '))
    pg.click('#tab-hoje .hold-line'); pg.wait_for_timeout(400)
    print('M3 histórico:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:300])
    pg.close()
    # N: durante os jogos dá para mudar o lineup levado (mesmo quem já começou): a app segue esses
    N_AB = {'NYK': 'NY', 'SAS': 'SA', 'GSW': 'GS'}
    N_KEYS = ['minutes', 'points', 'fieldGoalsMade-fieldGoalsAttempted', 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', 'freeThrowsMade-freeThrowsAttempted', 'rebounds', 'assists', 'turnovers', 'steals', 'blocks', 'offensiveRebounds', 'defensiveRebounds', 'fouls', 'plusMinus']
    def n_ath(name, pts): return {'athlete': {'displayName': name}, 'stats': ['24', str(pts), '8-17', '1-4', '3-4', '5', '4', '2', '1', '0', '1', '4', '2', '+3']}
    N_D1 = run['days'][0]['date']
    n_games = {('4019%05d' % (j + 1)): gm for j, gm in enumerate(run['days'][0]['games'])}
    N_ST = {0: ('post', 4, 'Final'), 1: ('in', 3, '3rd 5:12'), 2: ('pre', 0, '1:30 AM')}
    N_LINES = {'BOS': [n_ath('Jaylen Brown', 0)], 'DET': [n_ath('Cade Cunningham', 24)], 'PHI': [n_ath('Tyrese Maxey', 19), n_ath('Jaylen Brown', 17)], 'NYK': [n_ath('Jalen Brunson', 14), n_ath('Karl-Anthony Towns', 12)]}
    def n_h(r):
        url = r.request.url; hdr = {'access-control-allow-origin': '*'}
        if 'scoreboard' in url:
            evs = [{'id': gid, 'date': gm[2], 'status': {'type': {'state': N_ST[i][0], 'shortDetail': N_ST[i][2], 'completed': N_ST[i][0] == 'post'}, 'period': N_ST[i][1]},
                    'competitions': [{'competitors': [{'homeAway': 'away', 'team': {'abbreviation': N_AB.get(gm[0], gm[0])}, 'score': '70'}, {'homeAway': 'home', 'team': {'abbreviation': N_AB.get(gm[1], gm[1])}, 'score': '74'}]}]} for i, (gid, gm) in enumerate(n_games.items())]
            return r.fulfill(status=200, content_type='application/json', headers=hdr, body=json.dumps({'events': evs}))
        if 'event=' not in url: return r.fulfill(status=200, content_type='application/json', headers=hdr, body='{}')
        gid = url.split('event=')[1][:9]; i = list(n_games).index(gid); gm = n_games[gid]
        if N_ST[i][0] == 'pre': return r.fulfill(status=200, content_type='application/json', headers=hdr, body=json.dumps({'header': {'competitions': [{'status': {'type': {'state': 'pre'}}}]}, 'boxscore': {'players': []}}))
        teams = [{'team': {'abbreviation': N_AB.get(t, t)}, 'statistics': [{'keys': N_KEYS, 'athletes': N_LINES.get(t, []) + [n_ath('Suplente %s %d' % (t, k), 2) for k in range(5)]}]} for t in gm[:2]]
        return r.fulfill(status=200, content_type='application/json', headers=hdr, body=json.dumps({'header': {'competitions': [{'status': {'type': {'state': N_ST[i][0], 'completed': N_ST[i][0] == 'post'}, 'period': N_ST[i][1]}}]}, 'boxscore': {'players': teams}}))
    dbn = seeded(); T = dbn['tables']
    T['runs'][0]['fictitious'] = False
    for d_ in T['run_days']: d_['games'] = [gm[:3] + ['espn:4019%05d' % (j + 1)] for j, gm in enumerate(d_['games'])] if d_['date'] == N_D1 else d_['games']
    T['members'].append({'user_id': 'u-eu', 'role': 'member'})
    T['profiles'].append({'user_id': 'u-eu', 'display_name': 'João', 'topshot_username': 'gandapanasco'})
    lu = ['sga', 'brunson', 'wemby', 'cade', 'maxey']
    T['user_runs'] = [{'user_id': 'u-eu', 'run_id': 'run-1', 'roster': {pid: {'uses': 2, 'status': 'ok'} for pid in list(roster['players'])[:16]}, 'plan': {'live': {N_D1: {'active': True, 'lineup': lu}}}, 'updated_at': '2026-10-20T10:00:00Z'}]
    T['chain_results'] = []; T['injuries'] = []
    pg = new_page(b, dbn)
    pg.route('https://site.api.espn.com/**', n_h)
    pg.clock.set_fixed_time('2026-10-21T00:30:00Z')
    pg.set_viewport_size({'width': 390, 'height': 1300})
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(5000)
    print('N botões ao vivo:', pg.locator('#tab-hoje .day-hero .jc-btns').inner_text().replace(chr(10), ' | '))
    pg.click('#tab-hoje button[data-action="live-lu"]'); pg.wait_for_timeout(2500)
    print('N folha:', pg.locator('#sheetPanel').inner_text().replace(chr(10), ' | ')[:700])
    pg.click('#sheetPanel button[data-action="past-lu-pick"][data-id="brunson"]'); pg.wait_for_timeout(300)
    pg.click('#sheetPanel button[data-action="past-lu-pick"][data-id="jbrown"]'); pg.wait_for_timeout(300)
    pg.locator('#sheetPanel').screenshot(path=str(shots / 'mudar-ao-vivo.png'))
    pg.click('#sheetPanel button[data-action="live-lu-save"]'); pg.wait_for_timeout(3000)
    print('N aviso:', pg.locator('#toast').inner_text())
    print('N ao vivo:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.live'))
    print('N placar:', pg.locator('#tab-hoje .day-hero').inner_text().replace(chr(10), ' | ')[:500])
    pg.close()
    # O: Jornada → modo Historic (dados lidos no Top Shot): equipa sugerida, tirar, procurar, carta, outro dia
    HISTJ = (root / 'test' / 'fixtures' / 'historic.json').read_text()
    dbo = seeded(); To = dbo['tables']; To['runs'][0]['fictitious'] = False
    To['members'].append({'user_id': 'u-eu', 'role': 'admin'}); To['profiles'].append({'user_id': 'u-eu', 'display_name': 'João', 'topshot_username': 'gandapanasco', 'smurfs': [{'id': 's1', 'topshot_username': 'terose'}]})
    To['user_runs'] = [{'user_id': 'u-eu', 'run_id': 'run-1', 'roster': {pid: {'uses': 2, 'status': 'ok'} for pid in list(roster['players'])[:16]}, 'plan': {}, 'updated_at': '2026-10-15T10:00:00Z'}]
    To['chain_results'] = []; To['injuries'] = []
    pg = new_page(b, dbo)
    pg.add_init_script("try { localStorage.setItem('fb-hist', " + json.dumps(HISTJ) + "); localStorage.setItem('fb-jmode', 'classic'); } catch (e) {}")
    pg.clock.set_fixed_time('2026-10-29T14:00:00Z')
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(3000)
    if pg.locator('#sheet').is_visible(): pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.select_option('#jmode', 'historic'); pg.wait_for_timeout(800)
    print('O historic:', ' · '.join(pg.locator('#tab-hoje .h-hero .nm').all_inner_texts()), '|', pg.locator('#tab-hoje .h-hero .gb').inner_text().replace('\n', ' '), '| dias:', pg.locator('#tab-hoje .day-strip .ds:not([disabled])').count(), 'de', pg.locator('#tab-hoje .day-strip .ds').count())
    pg.screenshot(path=str(shots / 'historic.png'), full_page=True)
    print('O smurf:', pg.locator('#tab-hoje .h-accs').inner_text().replace('\n', ' '), '|', pg.locator('#tab-hoje .h-port').inner_text())
    t1 = pg.locator('#tab-hoje .h-hero .nm').all_inner_texts(); pg.click('#tab-hoje button[data-action="h-acc"] >> nth=1'); pg.wait_for_timeout(400)
    t2 = pg.locator('#tab-hoje .h-hero .nm').all_inner_texts(); pg.click('#tab-hoje button[data-action="h-acc"] >> nth=0'); pg.wait_for_timeout(400)
    print('O equipas diferentes:', len(set(t2) - set(t1)), 'lendas mudam')
    first = pg.locator('#tab-hoje .h-hero .nm').first.inner_text()
    pg.locator('#tab-hoje .h-hero button[data-action="h-card"]').first.click(); pg.wait_for_timeout(300)
    pg.click('#sheetPanel button[data-action="h-ban"]'); pg.wait_for_timeout(600)
    print('O tirar', first + ':', first not in pg.locator('#tab-hoje .h-hero .nm').all_inner_texts(), '· fora do dia:', pg.locator('#hList .h-ban .nm').all_inner_texts())
    pg.fill('#hSearch', 'drex'); pg.wait_for_timeout(300)
    print('O procurar drex:', pg.locator('#hList li[data-n]:visible .nm').all_inner_texts())
    pg.fill('#hSearch', ''); pg.click('#t-run'); pg.wait_for_timeout(400); pg.click('#t-hoje'); pg.wait_for_timeout(800)
    print('O modo fica guardado:', pg.locator('#jmode').input_value(), store(pg, 'localStorage.getItem("fb-jmode")'), '· tirado continua:', first not in pg.locator('#tab-hoje .h-hero .nm').all_inner_texts())
    pg.click('#tab-hoje button[data-action="h-reset"]'); pg.wait_for_timeout(500)
    pg.locator('#tab-hoje button[data-action="h-day"][data-id$="-d11"]').click(); pg.wait_for_timeout(800)
    print('O dia 11:', pg.locator('#tab-hoje .h-hero .eyebrow').inner_text(), '·', len(pg.locator('#tab-hoje .h-hero .nm').all_inner_texts()), 'lendas na equipa')
    print('O arquivo:', pg.locator('#tab-hoje .h-odds').first.inner_text().split('. ')[-1])
    pg.click('#tab-hoje button[data-action="h-day"][data-id$="-d9"]'); pg.wait_for_timeout(600)
    print('O dia que acabou:', pg.locator('#tab-hoje .h-hero .hero-top').inner_text().replace('\n', ' '), '·', pg.locator('#tab-hoje .card h2').all_inner_texts())
    pg.select_option('#jmode', 'pro'); pg.wait_for_timeout(1200)
    print('O pro:', pg.locator('#runMeta').inner_text(), '·', pg.locator('#tab-hoje .card h2').all_inner_texts(), '· dias:', pg.locator('#tab-hoje .day-strip .ds').all_inner_texts())
    pg.select_option('#jmode', 'classic'); pg.wait_for_timeout(800)
    print('O volta ao Classic:', pg.locator('#tab-hoje .day-strip [data-action="hd"]').count() > 0)
    pg.close()
    # K3: Classificação do grupo mal os jogos acabam: o Rui não abriu a app, mas partilhou o lineup do dia 2 (principal e
    # smurf): o resultado sai das fichas da ESPN, mais claro (por confirmar); a smurf tem a sua linha
    dbk = k_db(plan2, {pid: 1 for pid in lu1}); Tk = dbk['tables']
    if not any(m['user_id'] == 'u-rui' for m in Tk['members']): Tk['members'].append({'user_id': 'u-rui', 'role': 'member'})
    Tk['profiles'] = [x for x in Tk['profiles'] if x['user_id'] != 'u-rui'] + [{'user_id': 'u-rui', 'display_name': 'Rui', 'topshot_username': 'rui_ts', 'flow_address': '0x00000000000000c1', 'smurfs': [{'id': 's9', 'topshot_username': 'rui_smurf', 'flow_address': '0x00000000000000c2'}]}]
    Tk['runs'][0]['chain_run_id'] = 'c1'
    [m.update({'role': 'admin'}) for m in Tk['members'] if m['user_id'] == 'u-eu']  # só quem gere o grupo lê lugares e preços
    Tk['summaries'] = [{'user_id': 'u-rui', 'run_id': 'run-1', 'wins': 0, 'losses': 1, 'expected': 4.2, 'prize_probs': [], 'days': {d1: 'loss'}, 'next_p': 0.5, 'updated_at': '2026-10-21T22:00:00Z',
                        'share': {'accs': {'main': {'days': {d1: 'loss'}, 'lu': {d2: lu2}}, 's9': {'label': 'rui_smurf', 'wins': 0, 'losses': 0, 'expected': 3.1, 'prize_probs': [], 'days': {}, 'next_p': 0.4, 'lu': {d2: ['jokic', 'mitchell', 'ant', 'luka', 'curry']}}}}}]
    Tk['chain_results'] = [{'user_id': 'u-rui', 'account': 's9', 'game_id': 'g1', 'chain_run_id': 'c1', 'date': d1, 'points': 101, 'win': False, 'lineup': ['Jalen Brunson']}]
    calls = []
    pg = new_page(b, dbk)
    pg.route('https://site.api.espn.com/**', k_route({'GSW': [ath('Stephen Curry', 30, '7-14')], 'LAL': [ath('Luka Dončić', 33, '5-11')], 'MIN': [ath('Anthony Edwards', 27, '4-9')], 'CLE': [ath('Donovan Mitchell', 25, '2-6')], 'DEN': [ath('Nikola Jokić', 26, '1-2')]}, calls))
    pg.clock.set_fixed_time('2026-10-22T08:30:00Z')
    import base64 as _b64
    ranks_k3 = {'v': 1, 'at': '2026-10-22T08:00:00Z', 'run': {'id': 'run-nba-classic-2026-10-20', 'name': 'CLASSIC - RUN 1'}, 'total': 2601, 'cut': {'50': 2, '250': 2},
                'accs': [{'a': '00000000000000c2', 'found': True, 'rank': 12, 'wins': 2}, {'a': '00000000000000c1', 'found': True, 'rank': 574, 'wins': 1}],
                'bands': [[1, 1, 200000, ''], [11, 30, 5000, ''], [151, 250, 200, '']], 'qual': 50,
                'days': [{'id': 'c-d2', 'date': d2, 'final': True, 'total': 2343, 'accs': {'00000000000000c1': {'rank': 26, 'won': True}, '00000000000000c2': {'rank': 80, 'won': False}}, 'asked': ['00000000000000c1', '00000000000000c2']}], 'px': {'at': '2026-10-22T07:30:00Z', 'p': {**{'x%d' % i: [100, None, None] for i in range(60)}, **{p_['id']: [100, (700 + 10 * i_) if i_ % 2 else None, None] for i_, p_ in enumerate(Tk['nba_players'])}, 'curry': [250, 1890, None]}, 'miss': ['brunson']}}
    pg.goto('https://site.test/#fbranks=' + _b64.urlsafe_b64encode(json.dumps(ranks_k3).encode()).decode().rstrip('=')); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit')
    pg.wait_for_function('() => ((__FAKE_DB.tables.user_runs[0].plan.played || {})["%s"] || {}).done' % d2, timeout=15000); pg.wait_for_timeout(500)
    pg.click('#t-grupo'); pg.wait_for_timeout(1500)
    rows_k3 = [x.replace('\n', ' | ') for x in pg.locator('#tab-grupo .gc tbody tr').all_inner_texts()]
    print('K3 lugares:', pg.locator('#tab-grupo').inner_text().replace('\n', ' | ')[:700])
    print('K3 classificação:', ' // '.join(r[:90] for r in rows_k3), '· células ganhas:', pg.locator('#tab-grupo .gc td.c.w').count())
    print('K3 o meu resumo:', store(pg, '(() => { const x = __FAKE_DB.tables.summaries.find(r => r.user_id === "u-eu"); return x ? { days: x.days, accs: x.share && x.share.accs && Object.fromEntries(Object.entries(x.share.accs).map(([k, v]) => [k, { days: v.days, lu: v.lu }])) } : null; })()'))
    pg.screenshot(path=str(shots / 'grupo-smurfs.png'), full_page=True)
    pg.set_viewport_size({'width': 390, 'height': 800}); pg.wait_for_timeout(200); pg.screenshot(path=str(shots / 'grupo-grelha.png'), full_page=True); print('K3 largura grelha:', width(pg))
    pg.locator('#tab-grupo .gc tr[data-acc="s9"]').click(); pg.wait_for_timeout(300)
    print('K3 folha da smurf:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:260])
    # preços lidos no Top Shot (vêm com os lugares): ficha do jogador e resumo publicado
    pg.click('#sheetPanel button[data-action="close-sheet"]'); pg.wait_for_timeout(200)
    pg.click('#t-plantel'); pg.wait_for_timeout(500)
    pg.locator('#plBody .pl-card').filter(has_text='Curry').first.click(); pg.wait_for_timeout(500)
    print('K3 mercado Curry (Top Shot):', pg.locator('#sheetPanel .mkt-box').inner_text().replace('\n', ' | ') if pg.locator('#sheetPanel .mkt-box').count() else '-')
    print('K3 preços publicados:', store(pg, '(() => { const x = __FAKE_DB.tables.summaries.find(r => r.user_id === "u-eu"); return x && x.share && x.share.px ? x.share.px.p : null; })()'))
    tables_k3 = pg.evaluate('JSON.stringify(__FAKE_DB.tables)')
    pg.click('#sheetPanel button[data-action="close-sheet"]'); pg.wait_for_timeout(200)
    # com preços lidos (≥50 jogadores): as compras só sugerem quem tem um Rare à venda, e mostram o preço
    pg.click('#t-plantel'); pg.wait_for_timeout(300); pg.click('#tab-plantel button[data-action="sub"][data-sub="comprar"]'); pg.wait_for_timeout(300)
    pg.click('#tab-plantel button[data-action="buy-run"]'); pg.wait_for_selector('#buyOut .buy-row, #buyOut .note', timeout=30000); pg.wait_for_timeout(300)
    print('K3 compras com preços:', pg.locator('#buyOut').inner_text().replace('\n', ' | ')[:420])
    pg.route('https://nbatopshot.com/**', lambda r: r.fulfill(status=200, content_type='text/html', body='<html><body>ts</body></html>'))
    pg.click('#meBtn'); pg.wait_for_timeout(300); pg.click('#tab-ajustes button[data-action="sub"][data-sub="admin"]'); pg.wait_for_timeout(400); pg.click('#tab-ajustes button[data-action="ranks-go"][data-do="px"]'); pg.wait_for_url('https://nbatopshot.com/**', timeout=5000)
    job = json.loads(_b64.urlsafe_b64decode((pg.evaluate('window.name').split(':', 1)[1] + '===')).decode())
    print('K3 pedido ao Top Shot:', len(job['accs']), 'contas ·', len(job.get('pl') or []), 'jogadores para preços · 1.º:', (job.get('pl') or [None])[0])
    # a app do ecrã principal (ou outro aparelho) não tem o que o Safari guardou: os preços e lugares vêm do meu resumo
    # e não se perdem quando ela publica o resumo dela
    db2 = dict(dbk); db2['tables'] = json.loads(tables_k3)
    [m.update({'role': 'member'}) for m in db2['tables']['members'] if m['user_id'] == 'u-eu']
    pg2 = new_page(b, db2); pg2.route('https://site.api.espn.com/**', lambda r: r.fulfill(status=404, body='')); pg2.clock.set_fixed_time('2026-10-22T08:40:00Z')
    pg2.goto('https://site.test/'); pg2.wait_for_timeout(500)
    pg2.fill('#auEmail', 'eu@x.pt'); pg2.fill('#auPass', 'segredo1'); pg2.click('#auSubmit'); pg2.wait_for_timeout(4000)
    print('K3 outro aparelho: preços no resumo:', store(pg2, '(() => { const x = __FAKE_DB.tables.summaries.find(r => r.user_id === "u-eu"); return !!(x && x.share && x.share.px && x.share.px.p.curry); })()'), '· lugares no resumo:', store(pg2, '(() => { const x = __FAKE_DB.tables.summaries.find(r => r.user_id === "u-eu"); return !!(x && x.share && x.share.ranks); })()'), '· guardados aqui:', pg2.evaluate("!!localStorage.getItem('fb-px')"))
    pg2.click('#t-grupo'); pg2.wait_for_timeout(800)
    print('K3 membro sem o botão dos lugares:', pg2.locator('button[data-action="ranks-go"]').count() == 0)
    pg2.close()
    pg.close()

    # ---------- L: Mudar o lineup antes dos jogos (fixar, tirar e pôr um a um, com o que muda face à sugestão) ----------
    db = seeded(); T = db['tables']
    T['runs'][0]['fictitious'] = False
    T['members'].append({'user_id': 'u-eu', 'role': 'member'})
    T['profiles'].append({'user_id': 'u-eu', 'display_name': 'João', 'topshot_username': 'gandapanasco'})
    T['user_runs'] = [{'user_id': 'u-eu', 'run_id': 'run-1', 'roster': {pid: {'uses': 2, 'status': 'ok'} for pid in list(roster['players'])[:16]}, 'plan': {}, 'updated_at': '2026-10-15T10:00:00Z'}]
    T['chain_results'] = []; T['injuries'] = []
    pg = new_page(b, db)
    pg.clock.set_fixed_time('2026-10-20T15:00:00Z')
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(2500)
    lu_idle = "() => { const b = document.getElementById('luBody'); return b && !b.classList.contains('busy') && !document.getElementById('luProg'); }"
    pg.click('#tab-hoje button[data-action="lu-edit"]'); pg.wait_for_function(lu_idle, timeout=60000); pg.wait_for_timeout(300)
    print('L mudar (abrir):', pg.locator('#luBody .lu-kv').inner_text().replace('\n', ' | '), '· no lineup:', pg.locator('#luBody .lu-row button[data-action="lu-ban"]').count(), '· para pôr:', pg.locator('#luBody button[data-action="lu-add"]').count())
    who = pg.locator('#luBody button[data-action="lu-add"]:not([disabled])').first.get_attribute('data-id')
    pg.locator('#luBody button[data-action="lu-add"]:not([disabled])').first.click(); pg.wait_for_timeout(200); pg.wait_for_function(lu_idle, timeout=60000); pg.wait_for_timeout(1200)
    print('L pôr', who + ':', pg.locator('#luBody .lu-kv').inner_text().replace('\n', ' | '), '·', ' / '.join(pg.locator('#luBody .note').all_inner_texts())[:120], '· fixados:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.locks'))
    print('L muda noutros dias:', pg.locator('#luBody .card').filter(has_text='Muda noutros dias').count())
    gone = pg.locator('#luBody .lu-row button[data-action="lu-ban"]').first.get_attribute('data-id')
    pg.locator('#luBody .lu-row button[data-action="lu-ban"]').first.click(); pg.wait_for_timeout(400)
    print('L tirar', gone, '(lugar livre):', pg.locator('#luBody .lu-gap').inner_text().replace('\n', ' | '), '· tirados (ainda nada):', store(pg, '__FAKE_DB.tables.user_runs[0].plan.bans'), '·', pg.locator('#luBody .note.info').first.inner_text()[:80])
    pg.locator('#sheetPanel').screenshot(path=str(shots / 'mudar-livre.png'))
    pg.click('#luBody button[data-action="lu-pick"]'); pg.wait_for_timeout(400)
    pg.screenshot(path=str(shots / 'mudar-quem-entra.png'))
    print('L quem entra:', pg.locator('#sheetPanel h3').first.inner_text(), '·', pg.locator('#sheetPanel .small.muted').first.inner_text(), '·', ' / '.join(x.replace('\n', ' ')[:60] for x in pg.locator('#sheetPanel button[data-action="lu-fill"]').all_inner_texts()[:3]), '· ‹', pg.locator('#sheetPanel .sheet-bar [data-action="sheet-back"]').count())
    who2 = pg.locator('#sheetPanel button[data-action="lu-fill"]:not([disabled])').first.get_attribute('data-id')
    pg.locator('#sheetPanel button[data-action="lu-fill"]:not([disabled])').first.click(); pg.wait_for_timeout(200); pg.wait_for_function(lu_idle, timeout=60000); pg.wait_for_timeout(1200)
    print('L entra', who2, 'no lugar de', gone + ':', store(pg, '{l: __FAKE_DB.tables.user_runs[0].plan.locks, b: __FAKE_DB.tables.user_runs[0].plan.bans}'), '·', pg.locator('#luBody .lu-kv').inner_text().replace('\n', ' | '), '· lugares livres:', pg.locator('#luBody .lu-gap').count())
    pg.click('#sheetPanel .sheet-bar [data-action="close-sheet"]'); pg.wait_for_timeout(500)
    print('L jornada depois:', ' / '.join(lineup_card(pg).locator('.row .nm').all_inner_texts()), '· com', who, ':', any(who in (x or '') for x in lineup_card(pg).locator('button[data-action="player"]').evaluate_all('els => els.map(e => e.dataset.id)')))
    pg.click('#tab-hoje button[data-action="lu-edit"]'); pg.wait_for_function(lu_idle, timeout=60000)
    pg.click('#sheetPanel button[data-action="lu-reset"]'); pg.wait_for_timeout(200); pg.wait_for_function(lu_idle, timeout=60000); pg.wait_for_timeout(1200)
    print('L voltar à sugestão:', store(pg, '{l: __FAKE_DB.tables.user_runs[0].plan.locks, b: __FAKE_DB.tables.user_runs[0].plan.bans}'), '· botão:', pg.locator('#tab-hoje button[data-action="opcoes"]').inner_text())
    pg.click('#sheetPanel .sheet-bar [data-action="close-sheet"]'); pg.wait_for_timeout(400)
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(400)
    print('L seta → dia seguinte:', pg.locator('#tab-hoje .ds[aria-pressed="true"]').inner_text().replace('\n', ' '), '·', pg.locator('.hero .eyebrow').inner_text())
    pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(400)
    print('L seta ← volta:', pg.locator('#tab-hoje .ds[aria-pressed="true"]').inner_text().replace('\n', ' '))
    print('L fotos no lineup:', lineup_card(pg).locator('.face').count(), '· motor noutro fio:', pg.evaluate('window.FB_WORKER || "não usado"'))
    print('L largura:', width(pg))
    # tirar um cadeado não muda o lineup desse dia
    ids_now = lambda: lineup_card(pg).locator('button[data-action="player"]').evaluate_all('els => els.map(e => e.dataset.id)')
    pg.click('#tab-hoje button[data-action="lu-edit"]'); pg.wait_for_function(lu_idle, timeout=60000); pg.wait_for_timeout(300)
    w3 = pg.locator('#luBody button[data-action="lu-add"]:not([disabled])').first.get_attribute('data-id')
    pg.locator('#luBody button[data-action="lu-add"]:not([disabled])').first.click(); pg.wait_for_timeout(200); pg.wait_for_function(lu_idle, timeout=60000); pg.wait_for_timeout(1200)
    pg.click('#sheetPanel .sheet-bar [data-action="close-sheet"]'); pg.wait_for_timeout(500)
    before = ids_now()
    pg.click('#tab-hoje button[data-action="lu-edit"]'); pg.wait_for_function(lu_idle, timeout=60000); pg.wait_for_timeout(300)
    pg.click('#luBody button[data-action="lu-lock"][data-id="' + w3 + '"]'); pg.wait_for_timeout(200); pg.wait_for_function(lu_idle, timeout=60000); pg.wait_for_timeout(1200)
    pg.click('#sheetPanel .sheet-bar [data-action="close-sheet"]'); pg.wait_for_timeout(500)
    after = ids_now(); kp = json.loads(store(pg, '{l: __FAKE_DB.tables.user_runs[0].plan.locks, k: __FAKE_DB.tables.user_runs[0].plan.keep}'))
    nt = pg.locator('#tab-hoje .note').filter(has_text='Lineup mantido')
    print('L tirar o cadeado de', w3 + ':', before, '→', after, '·', kp, '· aviso:', nt.count(), '· ok' if sorted(before) == sorted(after) and w3 in after and nt.count() else '· ERRO')
    pg.click('#tab-hoje button[data-action="keep-clear"]'); pg.wait_for_timeout(1500)
    print('L deixar o plano escolher:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.keep'), '· aviso:', pg.locator('#tab-hoje .note').filter(has_text='Lineup mantido').count())
    pg.close()

    # ---------- M: nunca mais dias fixados do que usos ----------
    db = seeded(); T = db['tables']
    T['runs'][0]['fictitious'] = False
    T['members'].append({'user_id': 'u-eu', 'role': 'member'})
    T['profiles'].append({'user_id': 'u-eu', 'display_name': 'João', 'topshot_username': 'gandapanasco'})
    ids16 = list(roster['players'])[:16]
    plays = lambda pid, d: any(roster['players'][pid]['team'] in g[:2] for g in d['games'])
    pm = next(pid for pid in ids16 if plays(pid, run['days'][0]) and sum(plays(pid, d) for d in run['days'][1:]) >= 2)
    later = [d['date'] for d in run['days'][1:] if plays(pm, d)]
    T['user_runs'] = [{'user_id': 'u-eu', 'run_id': 'run-1', 'roster': {pid: {'uses': 1 if pid == pm else 2, 'status': 'ok'} for pid in ids16}, 'plan': {'locks': {later[0]: [pm], later[1]: [pm]}}, 'updated_at': '2026-10-15T10:00:00Z'}]
    T['chain_results'] = []; T['injuries'] = []
    pg = new_page(b, db)
    pg.clock.set_fixed_time('2026-10-20T15:00:00Z')
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(2500)
    nt = pg.locator('#tab-hoje .note').filter(has_text='mais dias do que os usos')
    print('M aviso (1 uso, 2 dias fixados):', nt.inner_text().replace('\n', ' ')[:200] if nt.count() else 'ERRO sem aviso', '· velho aviso:', pg.locator('#tab-hoje .note').filter(has_text='Fixados mais vezes').count())
    pg.click('#tab-hoje button[data-action="locks-fix"]'); pg.wait_for_timeout(1500)
    lk = json.loads(store(pg, '__FAKE_DB.tables.user_runs[0].plan.locks'))
    print('M tirar cadeados a mais:', lk, '· ok' if lk.get(later[0]) == [pm] and not lk.get(later[1]) else '· ERRO')
    lu_idle = "() => { const b = document.getElementById('luBody'); return b && !b.classList.contains('busy') && !document.getElementById('luProg'); }"
    pg.click('#tab-hoje button[data-action="lu-edit"]'); pg.wait_for_function(lu_idle, timeout=60000); pg.wait_for_timeout(300)
    if pg.locator('#luBody button[data-action="lu-all"]').count(): pg.click('#luBody button[data-action="lu-all"]'); pg.wait_for_timeout(300)
    add = pg.locator('#luBody button[data-action="lu-add"][data-id="' + pm + '"]')
    if add.count():
        add.click(); pg.wait_for_timeout(300); toastx = pg.locator('#toast').inner_text(); pg.wait_for_function(lu_idle, timeout=60000); pg.wait_for_timeout(1500)
        lk = json.loads(store(pg, '__FAKE_DB.tables.user_runs[0].plan.locks')); d1 = run['days'][0]['date']
        print('M fixar no dia 1 (sem usos para mais):', lk, '·', toastx, '· ok' if lk.get(d1) == [pm] and not lk.get(later[0]) and not lk.get(later[1]) else '· ERRO')
    else: print('M fixar no dia 1: ERRO sem botão para', pm)
    pg.click('#sheetPanel .sheet-bar [data-action="close-sheet"]'); pg.wait_for_timeout(400)
    print('M aviso depois:', pg.locator('#tab-hoje .note').filter(has_text='mais dias do que os usos').count())
    pg.close()

    # ---------- I: dias de combinação (3PM e 3PA), usos pelo melhor Moment, vistas do plantel e sugestões de compra ----------
    db = seeded(); T = db['tables']
    T['runs'][0]['fictitious'] = False
    seed = json.loads((root / 'data' / 'seed' / 'runs' / 'run-1-classic-2026-27.json').read_text())
    for i, d in enumerate(T['run_days']): d['objectives'] = seed['days'][i]['objectives']
    T['members'].append({'user_id': 'u-eu', 'role': 'admin'})
    sets = {'Base Set': {'n': 30, 'auto': 'Common', 'how': 'set'}, 'Metallic Gold LE': {'n': 4, 'auto': 'Rare', 'how': 'set'}, 'Holo Icon': {'n': 1, 'auto': 'Legendary', 'how': 'tiragem', 'med': 49}}
    pids = list(roster['players'])
    def cp(pid, by): return {'name': roster['players'][pid]['name'], 'moments': sum(by.values()), 'owners': {'main': sum(by.values())}, 'sets': list(by), 'bySet': by, 'uses': sum(by.values())}
    cplayers = {pid: cp(pid, {'Base Set': 1}) for pid in pids}
    cplayers['jokic'] = cp('jokic', {'Metallic Gold LE': 1, 'Base Set': 3})  # regra antiga: 5 usos; certo: 2
    cplayers['sga'] = cp('sga', {'Holo Icon': 1, 'Base Set': 1})
    col = {'read_at': '2026-10-19T10:00:00Z', 'accounts': {'main': {'moments': 40, 'listed': 0}}, 'sets': sets, 'players': cplayers, 'outside': []}
    T['profiles'].append({'user_id': 'u-eu', 'display_name': 'João', 'topshot_username': 'gandapanasco', 'flow_address': '0xe7fb03955ade55fa', 'collection': col})
    ro = {pid: {'uses': 1, 'tierUses': 1, 'status': 'ok'} for pid in pids[:18]}  # os outros 10 são candidatos a compra
    ro['jokic'] = {'uses': 5, 'tierUses': 5, 'status': 'ok'}; ro['sga'] = {'uses': 4, 'tierUses': 5, 'status': 'ok'}
    T['user_runs'] = [{'user_id': 'u-eu', 'run_id': 'run-1', 'roster': ro, 'plan': {}, 'updated_at': '2026-10-15T10:00:00Z'}]
    T['chain_results'] = []; T['injuries'] = []
    later = [o for o in T['odds_days'] if o['date'] == '2026-10-21']; T['odds_days'] = [o for o in T['odds_days'] if o['date'] != '2026-10-21']  # as odds de hoje chegam com o site aberto
    # o mesmo jogador com dois nomes: "Steph Curry" no catálogo (sem jogos) e um "Steph Curry" posto à mão no plantel
    T['nba_players'].append({'id': 'steph-curry', 'name': 'Steph Curry', 'team': 'GSW', 'avg': None, 'gp': 0, 'updated_at': '2026-10-15T09:20:00Z'})
    ro['x-steph-curry'] = {'uses': 2, 'status': 'ok', 'name': 'Steph Curry', 'team': 'GSW'}
    T['user_runs'][0]['plan'] = {'locks': {'2026-10-23': ['x-steph-curry']}}
    # um amigo com o plano partilhado e jogadores fixados
    T['profiles'][0]['share_plan'] = True
    T['summaries'][0]['share'] = {'roster': {'sga': [2, 2, 1], 'curry': [1, 1, 1], 'giannis': [1, 1, 1]}, 'use': {}, 'lineups': {'2026-10-21': ['curry', 'giannis', 'edwards']}, 'locks': {'2026-10-21': ['curry', 'edwards']}}
    pg = new_page(b, db)
    pg.clock.set_fixed_time('2026-10-21T15:00:00Z')
    pg.goto('https://site.test/'); pg.wait_for_timeout(500)
    pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(3500)
    pg.click('#tab-hoje button[data-action="sub"][data-sub="porque"]'); pg.wait_for_timeout(300)
    print('I odds antes:', pg.locator('#tab-hoje .basis-line').first.inner_text().replace('\n', ' ')[:90])
    pg.evaluate('(rows) => { rows.forEach(r => { r.updated_at = "2026-10-21T15:05:00Z"; __FAKE_DB.tables.odds_days.push(r); }); document.dispatchEvent(new Event("visibilitychange")); }', later)
    pg.wait_for_timeout(1500)
    print('I odds ao voltar ao site:', pg.locator('#tab-hoje .basis-line').first.inner_text().replace('\n', ' ')[:90], '· aviso:', pg.locator('#toast').inner_text())
    pg.click('#tab-hoje button[data-action="sub"][data-sub="lineup"]'); pg.wait_for_timeout(300)
    print('I repetido junto:', store(pg, '{curry: __FAKE_DB.tables.user_runs[0].roster.curry, x: __FAKE_DB.tables.user_runs[0].roster["x-steph-curry"] || null, locks: __FAKE_DB.tables.user_runs[0].plan.locks}'), '· aviso:', pg.locator('#toast').inner_text())
    print('I usos pelo melhor Moment:', store(pg, '{jokic: __FAKE_DB.tables.user_runs[0].roster.jokic, sga: __FAKE_DB.tables.user_runs[0].roster.sga}'))
    print('I hero:', pg.locator('.hero').inner_text().replace('\n', ' | ')[:300])
    lu = lineup_card(pg)
    print('I lineup (valores):', ' // '.join(x.replace('\n', ' ') for x in lu.locator('.pv').all_inner_texts()[:3]))
    pg.screenshot(path=str(shots / 'combo-hoje.png'), full_page=True)
    print('I largura hoje:', width(pg))
    lu.locator('button[data-action="player"]').first.click(); pg.wait_for_timeout(400)
    print('I ficha (esperado):', pg.locator('#sheetPanel .kv').first.inner_text().replace('\n', ' ')[:120], '· bases:', pg.locator('#sheetPanel .basis h2').all_inner_texts())
    pg.click('#sheetPanel button[data-action="close-sheet"]'); pg.wait_for_timeout(200)
    pg.click('#tab-hoje button[data-action="sub"][data-sub="comparar"]'); pg.wait_for_timeout(400)
    print('I comparar (estatísticas):', pg.locator('#tab-hoje button[data-action="cmp-obj"]').all_inner_texts())
    pg.locator('#tab-hoje button[data-action="cmp-obj"]').nth(1).click(); pg.wait_for_timeout(300)
    print('I comparar 3PA:', pg.locator('#tab-hoje .cmp tbody tr').first.inner_text().replace('\n', ' ')[:120])
    # fixar quem o plano não põe hoje: primeiro mostra o que custa
    pg.locator('#tab-hoje .cmp tbody tr:not(.inl)').first.click(); pg.wait_for_timeout(400)
    who = pg.locator('#sheetPanel h3').inner_text()
    pg.click('#sheetPanel button[data-action="lock"]'); pg.wait_for_function("() => !document.getElementById('choiceProg')", timeout=60000); pg.wait_for_timeout(200)
    print('I fixar', who + ':', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:500])
    pg.screenshot(path=str(shots / 'fixar-aviso.png'), full_page=True)
    pg.click('#sheetPanel button[data-action="lock-yes"]'); pg.wait_for_timeout(1500)
    print('I fixado:', store(pg, '__FAKE_DB.tables.user_runs[0].plan.locks'))
    pg.click('#tab-hoje button[data-action="sub"][data-sub="lineup"]'); pg.wait_for_timeout(200)
    # plantel: lista, plano por dia e valor por dia
    pg.click('#t-plantel'); pg.wait_for_timeout(500); pg.click('#tab-plantel button[data-action="sub"][data-sub="plantel"]'); pg.wait_for_timeout(500)
    print('I plantel (lista):', ' // '.join(x.replace('\n', ' ')[:140] for x in pg.locator('#plBody .pl-card').all_inner_texts()[:3]))
    print('I filtros:', ' | '.join(pg.locator('#plBody button[data-action="pl-filter"]').all_inner_texts()))
    pg.screenshot(path=str(shots / 'plantel-lista.png'), full_page=True)
    print('I largura lista:', width(pg))
    pg.click('#plBody button[data-action="pl-sort"][data-v="proximo"]'); pg.wait_for_timeout(300)
    pg.click('#plBody button[data-action="pl-filter"][data-v="proximo"]'); pg.wait_for_timeout(300)
    print('I jogam amanhã, por valor:', ' // '.join(x.replace('\n', ' ')[:90] for x in pg.locator('#plBody .pl-card').all_inner_texts()[:3]))
    pg.click('#plBody button[data-action="pl-filter"][data-v="todos"]'); pg.wait_for_timeout(200)
    pg.click('#plBody button[data-action="pl-view"][data-v="valor"]'); pg.wait_for_timeout(400)
    print('I valor por dia:', pg.locator('#plBody .mx-row').nth(1).inner_text().replace('\n', ' ')[:160])
    pg.screenshot(path=str(shots / 'plantel-valor.png'), full_page=True)
    print('I largura valor:', width(pg))
    pg.click('#plBody button[data-action="pl-view"][data-v="plano"]'); pg.wait_for_timeout(400)
    pg.screenshot(path=str(shots / 'plantel-plano.png'), full_page=True)
    pg.click('#plBody button[data-action="pl-view"][data-v="plano"]'); pg.wait_for_timeout(200)
    pg.locator('#plBody .pl-card').filter(has_text='Jokić').click(); pg.wait_for_timeout(300)
    print('I ficha Jokić:', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:260])
    pg.click('#sheetPanel button[data-action="close-sheet"]'); pg.wait_for_timeout(200)
    # sugestões de compra: em Hoje e no topo de Comprar
    pg.click('#tab-plantel button[data-action="sub"][data-sub="comprar"]')
    pg.wait_for_function("() => { const c = [...document.querySelectorAll('#plSub .card')].find(x => /Os Rare que mais compensam/.test(x.textContent)); return c && !/A refazer a run/.test(c.textContent); }", timeout=120000)
    print('I comprar (sugestões):', pg.locator('#plSub .card').first.inner_text().replace('\n', ' | ')[:400])
    pg.screenshot(path=str(shots / 'comprar-sugestoes.png'), full_page=True)
    pg.locator('#plSub button[data-action="buy-detail"]').first.click(); pg.wait_for_timeout(500)
    print('I abrir sugestão (folha):', pg.locator('#sheetPanel').inner_text().replace('\n', ' | ')[:260])
    pg.screenshot(path=str(shots / 'compra-detalhe.png'))
    pg.click('#sheetPanel button[data-action="close-sheet"]'); pg.wait_for_timeout(200)
    pg.click('#plSub button[data-action="buy-mode"][data-mode="more"]'); pg.wait_for_timeout(200)
    pg.click('#plSub button[data-action="buy-uses"][data-n="1"]'); pg.wait_for_timeout(200)
    pg.click('#plSub button[data-action="buy-run"]'); pg.wait_for_timeout(300); pg.wait_for_selector('#buyProg', state='detached', timeout=90000)
    print('I reforçar com Common:', pg.locator('#buyOut').inner_text().replace('\n', ' | ')[:240])
    pg.click('#t-hoje'); pg.wait_for_timeout(500)
    buy = pg.locator('#tab-hoje .card').filter(has_text='Melhores compras')
    print('I melhores compras (Jornada):', buy.inner_text().replace('\n', ' | ')[:200] if buy.count() else 'nenhuma', '· cartões de compra na Jornada:', pg.locator('#tab-hoje .card').filter(has_text='mais compensam').count())
    pg.click('#t-plantel'); pg.wait_for_timeout(300); pg.click('#tab-plantel button[data-action="sub"][data-sub="plantel"]'); pg.wait_for_timeout(400)
    print('I botão Adicionar no plantel (saiu):', pg.locator('#plSub .toolbar button[data-action="add-player"]').count())
    pg.click('#t-grupo'); pg.wait_for_timeout(400); pg.click('#tab-grupo button[data-action="sub"][data-sub="lineups"]'); pg.wait_for_timeout(500)
    print('I grupo lineups:', pg.locator('#tab-grupo .card').first.inner_text().replace('\n', ' | ')[:240])
    pg.screenshot(path=str(shots / 'grupo-lineups.png'), full_page=True)
    # admin: os dois objetivos do dia 2 ficam ao mudar o alvo do segundo
    pg.click('#meBtn'); pg.wait_for_timeout(300); pg.click('#tab-ajustes button[data-action="sub"][data-sub="admin"]'); pg.wait_for_timeout(500)
    print('I admin:', pg.locator('#tab-ajustes .card').first.inner_text().replace('\n', ' | ')[:200])
    pg.screenshot(path=str(shots / 'admin-combo.png'), full_page=True)
    # muda a língua para inglês em Ajustes → Preferências (a página recarrega com o app.en.js)
    pg.click('#tab-ajustes button[data-action="sub"][data-sub="prefs"]'); pg.wait_for_timeout(300)
    pg.click('#tab-ajustes button[data-action="lang"][data-v="en"]'); pg.wait_for_timeout(2500)
    print('J entrada em inglês:', pg.locator('#gate').inner_text().replace('\n', ' | ')[:140] if pg.locator('#auEmail').count() else 'sessão mantida')
    if pg.locator('#auEmail').count():  # a base falsa recomeça ao recarregar (no site a sessão fica guardada)
        pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(3500)
    print('J inglês:', pg.evaluate('document.documentElement.lang'), '·', pg.locator('#t-hoje').inner_text(), '/', pg.locator('#t-plantel').inner_text(), '/', pg.locator('#meBtn').inner_text())
    import re as _re
    PT = _re.compile(r'[ãçõê]|\b(não|jogador|jogadores|plano|vitória|vitórias|dias|hoje|usos|uso|está|são|ainda|já|com|sem|mais|menos|tens|teu|tua|conta|contas|jogo|jogos|lesão|lesões|forma|prémio|prémios|carteira|plantel|coleção|ajustes|grupo|amigos|ver|ler)\b', _re.I)
    def pt_left(where):
        txt = pg.evaluate('document.body.innerText')
        bad = sorted(set(m.group(0) for m in PT.finditer(txt)))
        if bad:
            lines = [l for l in txt.split('\n') if PT.search(l)][:6]
            print('J português em', where + ':', bad, '·', ' | '.join(l[:90] for l in lines))
        return bad
    left = []
    for tab, subs in [('hoje', ['lineup', 'porque', 'comparar']), ('run', ['premios', 'dias', 'analise', 'historico']), ('plantel', ['plantel', 'forma', 'lesoes', 'comprar', 'colecao']), ('grupo', ['classif', 'lineups', 'emprestimos']), ('ajustes', ['perfil', 'prefs', 'admin', 'dados'])]:
        pg.click('#meBtn' if tab == 'ajustes' else '#t-' + tab); pg.wait_for_timeout(400)
        for sub in subs:
            loc = pg.locator('#tab-' + tab + ' button[data-action="sub"][data-sub="' + sub + '"]')
            if not loc.count(): continue
            loc.first.click(); pg.wait_for_timeout(700 if sub != 'comprar' else 2500)
            left += pt_left(tab + '/' + sub)
            pg.screenshot(path=str(shots / ('en-' + tab + '-' + sub + '.png')), full_page=True)
    pg.click('#t-plantel'); pg.wait_for_timeout(300); pg.click('#tab-plantel button[data-action="sub"][data-sub="plantel"]'); pg.wait_for_timeout(400)
    for v in ['plano', 'valor']:
        pg.click('#plBody button[data-action="pl-view"][data-v="' + v + '"]'); pg.wait_for_timeout(400); left += pt_left('plantel/' + v)
    pg.locator('#plBody .mx-row:not(.head)').first.click(); pg.wait_for_timeout(400); left += pt_left('ficha do plantel'); pg.click('#sheetPanel button[data-action="close-sheet"]'); pg.wait_for_timeout(200)
    pg.click('#t-hoje'); pg.wait_for_timeout(300); pg.click('#tab-hoje button[data-action="sub"][data-sub="lineup"]'); pg.wait_for_timeout(400)
    pg.locator('#tab-hoje button[data-action="player"]').first.click(); pg.wait_for_timeout(400); left += pt_left('ficha do jogador')
    pg.screenshot(path=str(shots / 'en-ficha.png'), full_page=True); pg.click('#sheetPanel button[data-action="close-sheet"]'); pg.wait_for_timeout(200)
    pg.locator('#tab-hoje .hero button[data-action="opcoes"]').click(); wait_opcoes(pg); left += pt_left('opções'); pg.screenshot(path=str(shots / 'en-opcoes.png'), full_page=True); pg.click('#sheetPanel button[data-action="close-sheet"]'); pg.wait_for_timeout(200)
    pg.locator('#tab-hoje button[data-action="help"]').first.click(); pg.wait_for_timeout(300); left += pt_left('ajuda'); pg.click('#sheetPanel button[data-action="close-sheet"]'); pg.wait_for_timeout(200)
    print('J restos em português:', sorted(set(left)) or 'nenhum', '· largura', width(pg))
    pg.click('#meBtn'); pg.wait_for_timeout(300); pg.click('#tab-ajustes button[data-action="sub"][data-sub="prefs"]'); pg.wait_for_timeout(300)
    pg.click('#tab-ajustes button[data-action="lang"][data-v="pt"]'); pg.wait_for_timeout(2500)
    if pg.locator('#auEmail').count(): pg.fill('#auEmail', 'eu@x.pt'); pg.fill('#auPass', 'segredo1'); pg.click('#auSubmit'); pg.wait_for_timeout(3000)
    print('J de volta ao português:', pg.evaluate('document.documentElement.lang'), '·', pg.locator('#t-hoje').inner_text())
    pg.close()
    b.close()

print('erros:', errors or 'nenhum')
