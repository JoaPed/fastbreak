# Regras para o Claude neste repositório

Site do grupo para planear as runs do Fast Break (NBA Top Shot): https://joaped.github.io/fastbreak/
Dono: João (JoaPed). O site é usado todos os dias pelo grupo: o que entra no `main` fica no ar em ~1 minuto.

## Como trabalhar
- **Nunca enviar para o `main`.** Trabalha num ramo (`git switch -c nome-curto`) e abre um Pull Request
  (`gh pr create`) com: o que muda, porquê, como testaste e capturas de ecrã se mexe no aspeto.
  O João (ou o Claude dele) revê e junta.
- **`CHANGELOG.md`**: cada Pull Request (e cada envio do João para o `main`) acrescenta uma linha no topo, debaixo
  da data de hoje (`## AAAA-MM-DD`, cria-a se não houver): `- **Quem** — o que muda, em palavras de quem usa o
  site (#n.º do PR)`. Quem = o nome de quem pediu a mudança (ex.: João, ou o nome do teu amigo), não "Claude".
  Antes de mexer, lê as entradas novas para saber o que os outros mudaram.
- Antes de começar: `git pull` no `main` e cria o ramo a partir daí. O `docs/app.js` é grande e é onde há
  mais conflitos: mudanças pequenas e localizadas, sem reformatar nem mover código que não é preciso.
- Mudanças de aspeto: mostra primeiro como fica (capturas a 390 px de largura, claro e escuro) antes de
  dar o trabalho por acabado.
- Textos do site em **português de Portugal**, curtos e claros; comentários do código também em português.
  Percentagens em `%` (não "pp").

## Segurança (obrigatório)
- **Nenhuma chave secreta no repositório** (Supabase `sb_secret_…`/service_role, The Odds API, Telegram,
  SMTP). Os segredos vivem só em GitHub → Settings → Secrets and variables → Actions.
- Não mudar o `docs/config.js` (tem só o URL e a chave pública do Supabase).
- O `docs/fb-lugares.js` corre no browser dentro do Top Shot com a sessão de quem o usa: nunca enviar o
  token/autorização para lado nenhum; só lugares, picks, lineups e preços vão para o site.
- Não gastar créditos da The Odds API à toa (500/mês): não correr a tarefa das odds sem necessidade.

## Estrutura
- `docs/` — o site (estático, GitHub Pages):
  - `core.js` — motor do plano (modelo, otimizador, várias contas). Puro, sem DOM: também corre no
    `engine-worker.js`.
  - `app.js` — interface e Supabase (módulo ES, HTML em strings). `style.css`, `index.html`.
  - `app.en.js` / `core.en.js` — **gerados** (inglês). Nunca editar à mão.
  - `fb-lugares.js` (+ `fb-lugares.user.js`, userscript gerado a partir dele) — leitor do Top Shot.
- `scripts/` — tarefas das GitHub Actions (`.github/workflows/`): calendário e médias (ESPN), odds, lesões,
  blockchain, pedidos do site. Funções partilhadas em `scripts/lib.mjs`.
- `supabase/schema.sql` — base de dados e regras de acesso (idempotente: corre-se inteiro no SQL Editor).
- `i18n/en.json` — dicionário português → inglês.
- `test/` — testes (Node) e `ui_test.py` (Playwright, com um Supabase falso em `test/fake-supabase.js`).

## Inglês (sempre que mudam textos em `app.js` ou `core.js`)
1. `npm i --no-save acorn acorn-walk` (uma vez).
2. `node scripts/build-en.mjs --missing` lista os textos novos sem decisão (em `i18n/missing.json`).
3. Acrescenta-os ao `i18n/en.json`: `"texto": "tradução"`; `null` = fica igual (nomes, códigos internos);
   `{ "en": "…", "at": { "<linha>": true|false|"texto" } }` quando a mesma palavra é texto num sítio e valor
   interno noutro.
4. `node scripts/build-en.mjs` (gera os `.en.js`) e `node scripts/build-en.mjs --check` (tem de dizer
   "Inglês em dia."). Os `.en.js` vão no mesmo commit.

## Testes (antes de cada Pull Request)
- `npm ci && npm test` → tem de acabar em "todas as regras passaram".
- `pip install playwright && python3 -m playwright install chromium` (uma vez), depois
  `python3 test/ui_test.py` → tem de acabar em "erros: nenhum" (demora ~10 min). Com
  `FB_SKIP_EN=1` salta a verificação do inglês enquanto estás a meio.
- Funcionalidade nova → teste novo (motor em `test/engine.test.mjs`, tarefas em `test/jobs.test.mjs`,
  base em `test/schema.test.mjs`, interface em `test/ui_test.py`).
- Mudanças no `supabase/schema.sql`: mantém-no idempotente, testa em `test/schema.test.mjs` e diz no PR
  que o João tem de o correr no Supabase.

## Coisas a saber do domínio
- Uma run tem ~13 dias; cada dia tem objetivos (ex.: 120 PTS, ou 45 FGM + 55 FGA) e lineups de 5.
- Cada Moment tem usos por run (pela melhor carta: Common 1, Rare 2, Legendary 4, Ultimate ilimitado, ou
  mais pelo ASP). Os usos são por conta; com smurfs o plano é conjunto e cada carta joga numa conta por noite.
- O lineup de hoje fica fixo (`plan.hold`) e só troca sozinho se alguém ficar de fora ou a run ganhar ≥ 2%;
  o histórico do dia está em `plan.lhist`. Durante os jogos, `plan.live[data]` é o lineup que a app segue.
- Dias fecham sozinhos pelas estatísticas da ESPN (`autoResults`); o Top Shot (leitor) corrige lineups e
  resultados.
