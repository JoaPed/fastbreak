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
5. Cada um põe o endereço Flow da carteira Dapper no perfil e, no **Plantel**, carrega em **Ler carteira**: o site lê os Moments diretamente da blockchain (no browser) e guarda a coleção no perfil, mesmo sem haver run. Numa run, os jogadores da coleção passam para o plantel. Os usos não estão na blockchain (dependem do escalão de cada Moment): os novos entram com 1 uso e acertam-se à mão.
6. **Run de teste** (admin, em Ajustes → Nova run): 11 dias a começar hoje, jogos inventados e objetivos com as estatísticas reais do Fast Break, para o grupo experimentar. Não gasta créditos de odds e apaga-se com um botão.

## Contas smurf
Em **Ajustes → Perfil**, cada pessoa pode juntar até 2 contas extra suas (utilizador do Top Shot e endereço Flow).
- **Ler carteiras** lê as coleções de todas as contas e guarda onde está cada Moment.
- O plano trata as coleções como uma só: escolhe o lineup de cada conta em cada noite, com os usos de cada conta, e um Moment só joga por uma conta em cada noite (regra do Top Shot). Maximiza a soma do valor dos prémios das contas.
- Diz que Moments mandar para que conta e até quando (**Mandar antes de hoje** no ecrã Hoje; lista completa em Run). Cada transferência tem um pequeno custo no cálculo, por isso o plano só manda Moments quando isso aumenta as hipóteses de prémio. Uma conta sem hipóteses pode ficar sem jogar num dia.
- No topo de Hoje, Run e Plantel escolhe-se a conta a ver; jogo a jogo e fechar o dia funcionam por conta. Os resultados das smurf também vêm da blockchain.
- A classificação do grupo conta só a conta principal.

## Estatísticas dos objetivos
Os objetivos vêm da blockchain com estes nomes. Para cada jogador, o plano usa a linha das casas de apostas quando existe; se não, a linha da estatística mais parecida ajustada pelas médias dele; se não houver odds, a média da época.

| Nome no Fast Break | No site | Odds usadas | Médias |
|---|---|---|---|
| POINTS | PTS | pontos | ESPN |
| REBOUNDS | REB | ressaltos | ESPN |
| ASSISTS | AST | assistências | ESPN |
| STEALS / BLOCKS | STL / BLK | roubos / desarmes | ESPN |
| THREE_POINTS_MADE | 3PM | triplos | ESPN |
| THREE_POINTS_ATT | 3PA | triplos (proporção) | ESPN |
| FIELD_GOALS_MADE | FGM | lançamentos marcados | ESPN |
| FIELD_GOALS_ATT | FGA | lançamentos marcados (proporção) | ESPN |
| OFFENSIVE_REBOUNDS | OREB | ressaltos (proporção) | ficha de cada jogador na ESPN |
| ASSISTS_MINUS_TURNOVERS | AST−TOV | assistências e perdas de bola | ESPN |
| POINTS_IN_PAINT | PIP | pontos (proporção) | **estimativa**: lançamentos de 2 marcados × 2 × parte feita na área |

Nomes novos que o leitor não conheça aparecem no log da tarefa **Fast Break na blockchain** ("estatística desconhecida") em vez de serem lidos mal.

## Limites a ter em conta
- **The Odds API grátis**: 500 créditos por mês. Custa 1 crédito por jogo e por mercado pedido (os dias de AST−TOV pedem dois). Com 2 leituras por dia, chega para a maior parte dos meses; se faltar, tira uma das horas em `.github/workflows/odds.yml`.
- **Pontos na área**: a ESPN não os dá por jogador, por isso as médias e os valores ao vivo são estimados. O resultado do dia vem sempre da blockchain.
- **Base de dados**: depois de atualizar o código, corre de novo `supabase/schema.sql` no SQL Editor (pode correr-se as vezes que for preciso; acrescenta o que falta sem apagar dados).
- **GitHub Actions**: as tarefas agendadas podem atrasar-se uns minutos. Num repositório público ficam suspensas ao fim de 60 dias sem commits; volta a ligá-las no separador Actions.
- **Supabase grátis**: o projeto adormece depois de 7 dias sem uso; as tarefas automáticas mantêm-no acordado.

## Confirmado e por confirmar
- Confirmado: as runs Classic estão na blockchain (contrato FastBreakV1), com objetivos, lineups e vitórias de cada conta. Em 137 dias lidos, todos os objetivos eram de total da equipa.
- O contrato também prevê objetivos "por jogador" (cada um tem de chegar ao valor) e lineups com menos jogadores do que o máximo. Se aparecer um, o site avisa e o plano trata-o como total.
- O endereço Flow a partir do utilizador do Top Shot: a API do Top Shot recusa pedidos do GitHub, por isso cada um põe o endereço à mão no perfil.
- O botão **Atualizar estatísticas ao vivo** lê as estatísticas do jogo na ESPN diretamente no browser. Se o browser o bloquear, os valores metem-se à mão.
- O site da NBA (cdn.nba.com) recusa pedidos vindos do GitHub e já não tem os jogos da época passada; por isso os dados vêm da ESPN.

## Desenvolvimento
```bash
npm install
npm test                     # motor, leitores de dados e regras de acesso da base de dados
python3 test/ui_test.py      # site completo num browser sem ecrã, com um Supabase falso
```
