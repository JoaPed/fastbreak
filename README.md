# Fastbreak Run Planner

Site para um grupo de amigos planear os lineups de uma run inteira do Fast Break (NBA Top Shot) e acompanhar os resultados uns dos outros.

- **Site**: página estática em `docs/`, publicada pelo GitHub Pages.
- **Dados e login**: Supabase (email e palavra-passe). Cada pessoa vê só o seu plantel; o grupo vê a classificação.
- **Cálculo**: no browser (`docs/core.js`). As odds dão a média esperada de cada jogador. O plano escolhe os 5 de cada dia para maximizar a probabilidade de chegar a cada patamar de prémio, respeitando os usos.
- **Dados automáticos** (GitHub Actions, pasta `scripts/`):

| Tarefa | Quando (UTC) | O quê |
|---|---|---|
| Calendário e médias NBA | 09:17 todos os dias | Jogos de cada dia das runs, plantéis atuais, médias da época passada e desta época (ESPN) |
| Odds dos jogadores | 15:07 e 21:37 | Linhas de mais/menos da estatística do objetivo de cada dia (The Odds API) |
| Fast Break na blockchain | de 30 em 30 min | Runs, dias, objetivos e resultados de cada membro (contrato FastBreakV1 na Flow) |
| Carregar dados manuais | quando muda `data/seed/` | Dados escritos à mão (por exemplo, odds coladas) |

## Instalação (uma vez, ~20 minutos)

### 1. Supabase
1. Cria um projeto (plano grátis, região Europa).
2. **Authentication → Sign In / Providers → Email**: desliga **Confirm email**. O email incluído no Supabase só envia 2 emails por hora para o projeto todo.
3. **SQL Editor → New query**: cola o conteúdo de `supabase/schema.sql` e carrega em **Run**.
4. **Settings → API Keys**: copia o **Project URL** e a chave **anon** (ou **publishable**) para `docs/config.js`. São públicas por natureza.

### 2. GitHub
1. **Settings → Pages**: *Deploy from a branch*, branch `main`, pasta `/docs`. O site fica em `https://<utilizador>.github.io/fastbreak/`.
2. **Settings → Secrets and variables → Actions → New repository secret**, três segredos:
   - `SUPABASE_URL`: o Project URL.
   - `SUPABASE_SERVICE_KEY`: a chave **service_role** (ou **secret**) do Supabase. Nunca a ponhas no código.
   - `ODDS_API_KEY`: a chave grátis de the-odds-api.com.
3. **Actions**: corre à mão, por esta ordem:
   - **Médias da época passada (correr uma vez)**, com `2025-26` (vem da ESPN; a tarefa diária também o faz sozinha no início de cada época);
   - **Calendário e médias NBA**;
   - **Fast Break na blockchain**, com `backfill` = `300000` na primeira vez (lê cerca de 3,5 dias para trás).

### 3. No site
1. A primeira pessoa a criar conta fica **admin**.
2. Em **Ajustes**: escolhe o código de convite, cria a run (nome, primeiro dia, número de dias), define os prémios por vitórias e os objetivos.
3. Quando a run aparecer na blockchain, liga-a em **Ajustes → Blockchain**: os objetivos e os resultados de todos passam a entrar sozinhos.
4. Manda aos amigos o link do site e o código de convite.

## Limites a ter em conta
- **The Odds API grátis**: 500 créditos por mês. Custa 1 crédito por jogo e por estatística pedida. Com 2 leituras por dia, chega para a maior parte dos meses; se faltar, tira uma das horas em `.github/workflows/odds.yml`.
- **GitHub Actions**: as tarefas agendadas podem atrasar-se uns minutos. Num repositório público ficam suspensas ao fim de 60 dias sem commits; volta a ligá-las no separador Actions.
- **Supabase grátis**: o projeto adormece depois de 7 dias sem uso; as tarefas automáticas mantêm-no acordado.

## Por confirmar no primeiro uso real
- Se as runs Classic aparecem na blockchain e com que nomes de estatística (o leitor regista no log as que não conhece).
- O endereço Flow a partir do utilizador do Top Shot. Se falhar, cada um pode pôr o endereço à mão no perfil.
- O botão **Atualizar estatísticas ao vivo** lê as estatísticas do jogo na ESPN diretamente no browser. Se o browser o bloquear, os valores metem-se à mão.
- O site da NBA (cdn.nba.com) recusa pedidos vindos do GitHub e já não tem os jogos da época passada; por isso os dados vêm da ESPN.

## Desenvolvimento
```bash
npm install
npm test                     # motor, leitores de dados e regras de acesso da base de dados
python3 test/ui_test.py      # site completo num browser sem ecrã, com um Supabase falso
```
