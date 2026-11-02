# Fastbreak Run Planner — notas técnicas

Versão 3 (10 out 2026). Capacidades: db, sample (com imagens).
O código-fonte completo está no próprio artifact (Artifact → read devolve o HTML). O motor de cálculo está no primeiro <script> (objeto global FB); a interface está no segundo.

## Decisões (10 out 2026)
- Modo: Classic.
- Leaderboard diário ordenado pelo total → modo "tudo pelo dia" maximiza o percentil 90 do total.
- Prémio da run: por número de vitórias (patamares) → o plano maximiza Σ valor × P(vitórias ≥ patamar), com as vitórias esperadas só como desempate.
- O lineup fecha jogo a jogo → modo "Jogo a jogo" recalcula durante o dia.
- Odds: grátis, recolhidas pelo Claude via pesquisa web (sem The Odds API por agora).

## Pedido em aberto (15 out 2026)
O utilizador quer pôr a app online para amigos fazerem login e acompanhar os resultados deles. Duas vias em cima da mesa: (A) continuar no claude.ai com amigos convidados; (B) site próprio (ex.: Vercel + Supabase) com login Google/email. Decisão pendente.

## Fontes de dados verificadas (15 out 2026)
- **Fast Break está na blockchain Flow** — contrato `FastBreakV1` (repo github.com/dapperlabs/nba-smart-contracts, `contracts/FastBreakV1.cdc`). Leitura pública:
  - `getFastBreakRun(id)` → nome, início/fim, `runWinCount: {playerId: vitórias}`.
  - `getFastBreakGame(id)` → prazo de submissão, nº de jogadores, estado, vencedor, run; `getFastBreakSubmissionByPlayerId(playerId)` → `points`, `win`.
  - `getFastBreakGameStats(id)` → objetivo do dia (`name`, `type`, `valueNeeded`).
  - `getPlayerIdByAccount(address)`; o recurso Player guarda `playerName` (username).
  - IDs de runs/jogos são uuids off-chain: descobrir via eventos `FastBreakRunCreated` / `FastBreakGameCreated` (API de acesso Flow).
  - Scripts de exemplo em `transactions/fastbreak/scripts/`.
  → Permite ler objetivos, lineups, pontos e vitórias de cada amigo automaticamente, mas só a partir de um servidor (o artifact não pode fazer pedidos a outros domínios; o ambiente do Claude também não chega à Flow).
- **The Odds API**: custo de `/events/{id}/odds` = nº de mercados devolvidos × nº de regiões; `/events` é grátis; respostas vazias não contam. Só a estatística do dia, 1 região → ~1 crédito por jogo → ~8/dia, cabe nos 500/mês grátis com uma recolha diária.
- **Multi-utilizador no artifact**: pessoas de fora da conta só escrevem dados se convidadas por email como Editor (e sem link público), o que também lhes permite publicar versões da página. Dados privados por pessoa em `data/users/{id}`; ids e nomes via capacidade `user`.
- A partir deste ambiente não se chega a Vercel, Supabase nem Flow (só GitHub e registos de pacotes). Para um site próprio: escrever o código, pôr no GitHub do utilizador e ele liga o Vercel/Supabase.

## Interface (v3)
Separadores: Hoje (placar do próximo dia, estratégia, lineup, jogo a jogo, fechar o dia) · Run (probabilidade de cada patamar de prémio + lista compacta de dias) · Plantel (matriz jogadores × dias com usos) · Ajustes (prémios, objetivos, ler objetivos por texto/captura, dados, runs).

## Base de dados (documentos)
- `app/state` → `{ activeRun, runs: [{id, name, start, end}] }`
- `runs/{runId}` → `{ name, mode, fictitious?, start, end, prizes: [{wins, value, label?}], days: [{ date: "AAAA-MM-DD", objectives: [{stat, target}], games: [[fora, casa, inícioISO_UTC], …] }] }`
- `rosters/{runId}` → `{ players: { id: { name, team, uses, status: ok|prov|duv|fora, avg: {pts, reb, ast, fg3, stl, blk} } } }`. `uses` = usos RESTANTES para os dias por jogar.
- `odds/{runId}` → `{ days: { "AAAA-MM-DD": { updatedAt, source, players: { id: { pts: {line, over, under}, reb: …, status?: duv } } } } }`. Odds em formato americano (-115) ou decimal (1.87).
- `plans/{runId}` → `{ locks: {data: [ids]}, bans: {data: [ids]}, played: {data: {done, result: win|loss, lineup: [ids]}}, mode: {data: run|allin}, live: {data: {active, lineup: [ids submetidos], players: {id: {state: por|jogo|fim, q: 1-4, vals: {stat: n}}}, startedGames?: [equipas]}} }`

Stats: pts, reb, ast, fg3 (triplos), stl, blk. Ids de equipa: 3 letras (BOS, NYK, …).

## Jogo a jogo (como o motor trata o dia em curso)
- Um jogo conta como começado se a hora de início já passou, ou se algum jogador desse jogo está marcado "Em jogo"/"Terminado".
- Jogadores do lineup submetido cujo jogo começou ficam presos; o que já fizeram soma ao total; se estão em jogo, conta só a fração que falta (1.º período 82%, 2.º 57%, 3.º 32%, 4.º 8%).
- Jogadores de jogos já começados que não estão no lineup deixam de poder entrar.
- Os lugares restantes são re-otimizados com a run toda; a diferença face ao lineup submetido aparece como "Troca recomendada".

## Como atualizar odds de um dia (Claude)
1. Pesquisar linhas públicas de props NBA desse dia para os jogadores do plantel + estado de lesões.
2. Ler `odds/{runId}` (para obter a version) e fazer `update` com `days.{data}` = `{ updatedAt, source, players: {...} }`.
3. Só é preciso o stat do objetivo desse dia.

## Run fictícia carregada
`teste-out26`: 11 dias (20–30 out 2026), dia 1 com os 3 jogos reais da noite de abertura e os restantes inventados (com horas); 28 jogadores com médias aproximadas; odds simuladas nos dias 1 e 2; patamares de exemplo 5/7/9 vitórias (valor 10/30/100).

## Método
- Linha + odds → probabilidade sem margem → média (Normal com variância k·μ para pts/reb/ast; Poisson para 3PM/STL/BLK). k: pts 2,0; reb 1,3; ast 1,3; 3PM 1,15; STL 1,0; BLK 1,1.
- Estado: Provável 90%, Dúvida 50%, Fora 0% de jogar (mistura).
- P(vitória) = P(soma ≥ alvo), aproximação normal com correção de continuidade; vários objetivos = produto.
- Distribuição de vitórias da run: Poisson-binomial exata sobre os dias por jogar.
- Otimizador: inicialização gulosa + arrefecimento simulado (semente fixa) + subida exaustiva com trocas e substituições; respeita usos, fixados e tirados. O plano "tudo pelo dia" substitui o plano da run se tiver melhor valor.
