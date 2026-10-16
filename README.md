# Fastbreak Run Planner

Site para um grupo de amigos planear os lineups de uma run inteira do Fast Break (NBA Top Shot) e acompanhar os resultados uns dos outros.

- **Site**: página estática em `docs/`, publicada pelo GitHub Pages.
- **Dados e login**: Supabase (email e palavra-passe). Cada pessoa vê só o seu plantel; o grupo vê a classificação.
- **Cálculo**: no browser (`docs/core.js`). As odds dão a média esperada de cada jogador. O plano escolhe os 5 de cada dia para maximizar a probabilidade de chegar a cada patamar de prémio, respeitando os usos.
- **Dados automáticos** (GitHub Actions, pasta `scripts/`):

| Tarefa | Quando (UTC) | O quê |
|---|---|---|
| Calendário e médias NBA | 09:17 todos os dias | Jogos de cada dia das runs, plantéis atuais, médias da época passada e desta época, e as estatísticas de cada jogo terminado para a forma (últimos 5 e 10 jogos) (ESPN) |
| Odds dos jogadores | 15:07 e 21:37 | Linhas de mais/menos da estatística do objetivo de cada dia (The Odds API) |
| Fast Break na blockchain | de 30 em 30 min | Runs, dias, objetivos e resultados de cada membro (contrato FastBreakV1 na Flow). Cada run Classic nova é criada no site sozinha, já ligada e ativa. Aos poucos, lê também o histórico de cada conta (todos os dias jogados, de todas as runs) |
| Lesões | de 30 em 30 min, das 13h às 4h | Relatório de lesões da NBA (ESPN) |
| Carregar dados manuais | quando muda `data/seed/` | Dados escritos à mão (por exemplo, odds coladas) |

## Como está organizado
Cada separador tem partes no topo (ficam lembradas neste aparelho):
- **Hoje**: *Lineup* (placar do dia; **A fazer**: Moments a mandar entre contas, lesões no lineup, dia por fechar, ligar o jogo a jogo; o lineup; **Quem joga hoje** com lesões e forma; **Sugestões de compra**), *Porquê* (em que se baseia e o que cada jogador acrescenta), *Comparar* (tabela dos jogadores com jogo hoje).
- **Run**: *Prémios* (vitórias e derrotas, um aro por prémio com a probabilidade em palavras e quantas vitórias faltam, o gráfico de quantas vitórias deves ter no fim, sugestões de compra e as lesões do plantel com os dias que afetam), *Dias* (com aviso nos dias com lesões no lineup), *Contas*, que só aparece a quem tem contas smurf no perfil (prémios de cada conta e as transferências), *Análise* (previsto vs real) e *Histórico* (todas as runs lidas da blockchain).
- As **sugestões de compra** calculam-se sozinhas em segundo plano (Moments de 2 usos de jogadores que ainda não tens) e atualizam quando o plano muda.
- **Jogadores**: *Plantel* (usos e plano; **Acertar usos** abre uma lista com pesquisa e botões − / + para mudar vários jogadores depressa), *Forma* (últimos 5 jogos face à época, teus ou de toda a NBA), *Lesões*, *Comprar* (o que compensa comprar e os **Especialistas** de cada estatística) e *Coleção* (carteiras).
- **Grupo**: *Classificação* (aros de cada um), *Lineups* (o lineup que o plano de cada amigo sugere para cada dia) e *Empréstimos* (Moments dos amigos que compensa pedir, só nos dias em que eles não os usam).
- **No telemóvel como app**: no iPhone, abre o site no Safari → Partilhar → **Adicionar ao ecrã principal**. Abre em ecrã inteiro, com ícone próprio.
- **Ajustes**: *Perfil*, *Preferências*, *Admin* (só o admin) e *Dados*.

Os aros: cada patamar de prémio (por exemplo 5, 7 e 9 vitórias) é um aro que enche com a probabilidade de lá chegares. Verde é provável, amarelo meio-meio, vermelho difícil.

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
2. Em **Ajustes → Admin**: escolhe o código de convite, cria a run (nome, primeiro dia, número de dias), define os prémios por vitórias e os objetivos.
3. Quando a run aparecer na blockchain, liga-a em **Ajustes → Admin → Blockchain**: os objetivos e os resultados de todos passam a entrar sozinhos.
4. Manda aos amigos o link do site e o código de convite.
5. Cada um põe o endereço Flow da carteira Dapper no perfil e, em **Jogadores → Coleção**, carrega em **Ler carteira**: o site lê os Moments diretamente da blockchain (no browser) e guarda a coleção no perfil, mesmo sem haver run. Numa run, os jogadores da coleção passam para o plantel. Os usos não estão na blockchain (dependem do escalão de cada Moment): os novos entram com 1 uso e acertam-se à mão.
6. **Run de teste** (admin, em Ajustes → Admin): 11 dias a começar hoje, jogos inventados e objetivos com as estatísticas reais do Fast Break, para o grupo experimentar. Não gasta créditos de odds e apaga-se com um botão.

## Contas smurf
Em **Ajustes → Perfil**, cada pessoa pode juntar até 2 contas extra suas (utilizador do Top Shot e endereço Flow).
- **Ler carteiras** lê as coleções de todas as contas e guarda onde está cada Moment.
- O plano trata as coleções como uma só: escolhe o lineup de cada conta em cada noite, com os usos de cada conta, e um Moment só joga por uma conta em cada noite (regra do Top Shot). Maximiza a soma do valor dos prémios das contas.
- Diz que Moments mandar para que conta e até quando (**Mandar antes de hoje** no ecrã Hoje; lista completa em Run → Contas). Cada transferência tem um pequeno custo no cálculo, por isso o plano só manda Moments quando isso aumenta as hipóteses de prémio. Uma conta sem hipóteses pode ficar sem jogar num dia.
- No topo de Hoje, Run e Jogadores escolhe-se a conta a ver; jogo a jogo e fechar o dia funcionam por conta. Os resultados das smurf também vêm da blockchain.
- A classificação do grupo conta só a conta principal.

## Lesões
- **Relatório de lesões**: a tarefa **Lesões** lê o relatório de lesões da NBA na ESPN (Fora, Fora da época, Pouco provável, Dúvida, Dia a dia, Provável; lesão, notícia curta e regresso previsto) e guarda-o na base de dados.
- **No plano**: o relatório fala do próximo jogo de cada jogador. Nesse jogo: Fora → não entra; Pouco provável → 25% de jogar; Dúvida ou Dia a dia → 50%; Provável → 90%. Nos jogos seguintes conta a data prevista de regresso (Fora) ou volta ao normal aos poucos. Se puseres um estado à mão no plantel, conta o pior dos dois. Na ficha do jogador dá para **ignorar o relatório** (quando sabes que ele joga).
- **Onde aparece**: no lineup de Hoje ("lesão: …"), em **Em que se baseia**, na ficha de cada jogador, e em **Jogadores → Lesões** (o teu plantel e os jogadores importantes do resto da NBA).
- **Avisos antes dos jogos** (email ou telemóvel): o código está feito (`scripts/sync-injuries.mjs`, tabela `alerts`), mas está desligado por agora: o site não mostra a opção.

## Jogos seguidos, regularidade e jogos ao vivo
- **Jogos seguidos (back-to-back)**: no 2.º de dois dias seguidos, sem odds, o plano conta com 3% menos, ou com o que esse jogador fez nesses jogos na época passada (há quem não note diferença). As odds já contam com isso. Aparece "2.º seguido" no lineup e na tabela Comparar; desliga-se em Ajustes → Preferências.
- **Regularidade**: com os jogos da época passada (ESPN), o plano sabe quem varia muito de jogo para jogo e quem é regular, e usa isso na probabilidade de vitória. Os dados entram aos poucos pela tarefa Calendário e médias NBA (até 300 jogadores por dia).
- **Jogos de hoje**: durante os jogos, o ecrã Hoje mostra o placar de cada jogo (ESPN, atualiza a cada minuto) com os teus jogadores. Com o **Jogo a jogo** ligado, as estatísticas deles atualizam sozinhas de 2 em 2 minutos.

## Análise e histórico
- **Run → Análise**: até ao primeiro jogo de cada dia, o site guarda a previsão desse dia (vitória, total e o esperado de cada jogador do teu plantel que joga). Depois dos jogos compara com o que aconteceu: vitórias previstas e feitas, se a previsão acerta por grupos (menos de 35%, 35–65%, mais de 65%), o total de cada dia, os jogadores que ficam acima ou abaixo do previsto, e o erro com odds, só com médias e em jogos seguidos. Ao abrir um dia fechado vês o previsto ao lado do real, jogador a jogador. Os valores reais vêm do jogo a jogo ou dos últimos 5 jogos de cada jogador: abre o site pelo menos uma vez por semana para não se perderem.
- **Run → Histórico**: todos os teus dias de Fast Break (todas as contas e runs, também as passadas): vitórias, as estatísticas que mais saem com o alvo típico e como te correm, os jogadores que mais usaste e o resultado de cada run. A tarefa **Fast Break na blockchain** lê até 300 dias por conta de cada vez, por isso o histórico completo demora umas horas a aparecer. Os nomes dos jogadores só aparecem para Moments que ainda tens.
- **Jogadores → Comprar → Especialistas**: os melhores da NBA em cada estatística (médias desta época misturadas com as da passada), por ordem das estatísticas que mais saem. "Especialista" = no topo dessa estatística mas fora dos 75 melhores marcadores (costuma ser mais barato e pouco escolhido); "regular" ou "irregular" vem da época passada.

## Grupo: lineups e empréstimos
- Cada um partilha com o grupo (no resumo da run) o lineup que o plano sugere para cada dia, os usos dos seus jogadores e em que dias o plano os usa. O plantel e o plano continuam privados. Desliga-se em **Ajustes → Perfil → Partilhar com o grupo**.
- **Grupo → Empréstimos** refaz a tua run com os Moments dos amigos que não tens, só nos dias em que o plano deles não os usa, e diz a quem pedir: "Pede o Jalen Johnson ao Rui para os dias 2 e 10. O Rui usa-o no dia 8: devolve-lho antes do dia 8." Conta com os usos de um Moment dele numa run.

## Em que se baseia
- Em **Hoje → Porquê**, o cartão **Em que se baseia** diz de onde vem o lineup: para quantos jogadores há odds (e de quando são), quem está no relatório de lesões e com que probabilidade de jogar, como entram as médias e a forma, e como pesam os prémios da run.
- **Porquê estes jogadores**: quanto cada um acrescenta à vitória de hoje (quem entrava no lugar dele) e os mais fortes que ficam de fora, com a razão (guardado para os dias X, sem usos, em dúvida…).
- Na ficha de cada jogador, passo a passo: a linha das casas com os preços e a probabilidade sem a margem (ou, sem odds, as médias da época e dos últimos 10 e 5 jogos, a forma e o adversário), a probabilidade de jogar, e o valor final que o plano usa.
- Quando há odds para um dia, são elas que mandam (já incluem forma, adversário e minutos). Chegam para hoje e amanhã, à tarde; os outros dias usam as médias até lá.

## Dicas de compra
- Em **Jogadores → Comprar** refaz o plano da run com cada candidato e mostra quanto sobe a probabilidade de cada prémio, as vitórias esperadas e em que dias ele jogaria (com a vitória desse dia antes e depois). Exemplo: "Se comprares Stephen Curry com 2 usos, a probabilidade de chegares às 7 vitórias sobe de 22% para 30%: joga nos dias 3 (45% → 61%) e 7 (38% → 52%)."
- **Jogador novo** (do catálogo, com jogos nos dias que faltam) ou **Reforçar os teus** ("+1 uso" = comprar outro Moment desse jogador com 1 uso; com contas smurf, dois Moments deixam duas contas jogá-lo no mesmo dia). Escolhe os usos do Moment (1 a 4): dependem do escalão, da edição e do preço médio (em geral Common 1, Rare 1 a 3, Legendary 3 ou mais), por isso confirma no Top Shot. Também dá para avaliar um jogador em especial.
- Uma pré-seleção rápida escolhe os 8 melhores candidatos (5 com contas smurf) e só esses têm a run refeita. Os preços não entram nas contas.

## Forma e alternativas
- **Forma**: sem odds para um dia, o plano usa as médias, e estas misturam a época com os últimos 10 e 5 jogos (normal: época 50%, últimos 10 30%, últimos 5 20%; com poucos jogos a forma pesa menos). Em **Ajustes → Forma recente** escolhe-se *Só a época*, *Normal* ou *Forte*. As odds das casas já incluem a forma, por isso quando há odds mandam elas. No lineup aparece "em forma ↑" ou "fora de forma ↓" quando os últimos 5 jogos se afastam mais de 12% da época.
- **Alternativas**: no ecrã Hoje, **Ver 2 a 3 alternativas para hoje** mostra outros lineups (tudo pelo dia, ou guardar um dos jogadores que mais pesam para outro dia), cada um com o resto da run refeito e o efeito nos prémios. **Usar esta** fixa esse lineup hoje e refaz o resto; dá para voltar ao sugerido.

## Comparar jogadores
- Em **Hoje → Comparar** (e ao abrir um dia em Run → Dias), a tabela **Comparar jogadores** mostra todos os jogadores do plantel com jogo nesse dia: o que o plano espera, a linha das casas, médias dos últimos 5 e 10 jogos e da época, minutos, e conforme a estatística do dia, lançamentos e percentagens, ressaltos ofensivos e defensivos, assistências e perdas de bola, roubos e desarmes. Números grandes são os últimos 5 jogos e os pequenos a época. Toca num título para ordenar e num jogador para ver a ficha.
- **Adv.** é quanto o adversário concede dessa estatística face à média da liga, nos últimos 10 jogos dele. Sem odds, o plano ajusta a média do jogador por metade dessa diferença (no máximo ±10%).
- A ficha de cada jogador mostra os últimos 5 jogos (minutos, pontos, ressaltos, assistências, lançamentos, triplos, lances livres, perdas de bola, roubos, desarmes).
- Estes dados vêm da tarefa **Calendário e médias NBA** (box score de cada jogo terminado na ESPN) e aparecem depois dos primeiros jogos da época.

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
- **Relatório de lesões**: vem da ESPN, que segue o relatório oficial da NBA. Quem descansa ("Rest") também aparece. Se a ESPN não responder, fica o relatório anterior; se ficar parado mais de 3 dias, o plano deixa de o usar.
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
npm test                     # motor, leitores de dados, tarefas dos avisos e do histórico, e regras de acesso da base de dados
python3 test/ui_test.py      # site completo num browser sem ecrã, com um Supabase falso
```
