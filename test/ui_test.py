# Testa o site completo num Chromium sem ecrã, com o Supabase falso (test/fake-supabase.js).
import json, pathlib, sys
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
        games = [g[:3] + ['00226%05d' % (i * 20 + j + 1)] for j, g in enumerate(d['games'])]
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
    box = {'game': {'gameStatus': 2, 'period': 2, 'homeTeam': {'teamTricode': 'SAC', 'players': [{'personId': 'sabonis', 'statistics': {'reboundsTotal': 7, 'points': 9}}]}, 'awayTeam': {'teamTricode': 'X', 'players': []}}}
    pg.route('https://cdn.nba.com/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps(box)))
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
    print('B ajustes sem admin:', pg.locator('#inviteForm').count() == 0, '· secções:', pg.locator('#tab-ajustes h2').all_inner_texts())
    print('B resumo publicado:', store(pg, '__FAKE_DB.tables.summaries.find(s=>s.user_id==="u-eu")'))
    print('B plantel gravado:', store(pg, 'Object.keys(__FAKE_DB.tables.user_runs[0].roster).length'), 'jogadores')
    pg.click('button[data-action="logout"]'); pg.wait_for_timeout(300)
    print('B depois de sair:', pg.locator('#auSubmit').inner_text())
    b.close()

print('erros:', errors or 'nenhum')
