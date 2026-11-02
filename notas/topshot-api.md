# API do Top Shot usada pelo FB lugares (sondas de 25 out 2026)

Base: `https://api.production.atlas.dapperlabs.com/atlas.v1.<Serviço>/<Método>`, POST JSON, cabeçalhos `connect-protocol-version: 1` e o `authorization` da própria página (só usado dentro do Top Shot, nunca sai de lá).

## API pública, sem sessão (sonda da sessão, 2 nov 2026, `docs/sonda-sessao.html`)
- Com a Run 1 acabada, a página `nbatopshot.com/fastbreak?league=nba` já não põe `authorization` em nenhum pedido: lê tudo por `https://api.production.atlas.dapperlabs.com/public/atlas.v1.<Serviço>/<Método>` sem sessão. Vistos: GameEngineService/GetContestStandings, GetPlayerSlots, SearchContests, GetContest, GetGameBoxScores; LeaderboardService/GetLeaderboardPage; NFTService/GetNFTs.
- Na base privada, só com cookies, dá 401. Não há token no localStorage nem nos cookies visíveis (`/api/session` → `{}`).
- O leitor (sv 22, userscript v24) começa sozinho ~2,5 s depois de abrir e usa a base pública quando não tem sessão; com sessão usa a privada e, se esta der 401/403/404, tenta a pública. As trocas (`TransferNfts`) continuam a precisar da sessão (esperam por "Toca em Leaderboard").
- A run do site escolhe-se pelo 1.º dia (`job.runStart`, ±3 dias da data no id da run), mesmo com outra run ativa; sem a lista das ativas, vai por `run-nba-classic-<runStart>`.

## Runs e dias
- `GameEngineService/ListActiveRuns {product:'nba'}` → runs (id, name, mode `RUN_MODE_CLASSIC`, endsAt, reward.bands, reward.qualifier).
- `GameEngineService/SearchContests {product, runId}` → dias (`contest-run-nba-classic-2026-10-20-AAAA-MM-DD`): objectives (statKey, statAbbreviation, target), locksAt, status, reward.bands. Usado em "Run e prémios" (Admin) e nos lugares.
- `GameEngineService/GetContest {contestId}`, `GetGameBoxScores`, `GetPlayerIntelligence {playerId}` (médias e titular previsto, RotoBaller), `GetPlayerSlots` — vistos, ainda não usados.

## Lugares
- `LeaderboardService/GetSubjectRank {leaderboardId:'contest:<id>' ou 'run:<id>', subjectId:<endereço sem 0x>}` → entry {score, tiebreakerScore, rank, displayScore, user}. score ≥ 1 000 000 = ganhou o dia.
- `LeaderboardService/GetLeaderboardPage {leaderboardId, limit, offset}` (aceita offset).

## Lineups levados (decidido e feito a 25 out)
- `GameEngineService/GetEntry {contestId}` → só o próprio (ignora userFlowAddress/subjectId): slots com playerId (NBA), momentFlowId, playerName, score; objectiveProgress; rank; win.
- `GameEngineService/GetContestStandings {contestId, limit (até 100), cursor}` → rows {rank, score, won, username, flowAddress, lineup:[{slotIndex, playerId, momentFlowId, hidden}], lineupHidden}, nextCursor, hasMore, totalCount. **Não aceita offset nem startRank.** O cursor é base64 de `{"s":score,"t":tiebreaker,"a":timestamp,"u":endereço}` da última linha; com `{s: score, t: tiebreakerScore+1, a:0, u:''}` (valores do GetSubjectRank) a 1.ª linha é essa conta → 1 pedido por conta e dia.
- No site (commit de 25 out): o script (sv 12, userscript v12) junta `lu: [[idNBA, nomeNormalizado]]` a cada conta em cada dia lido (`d.luv = 1`); nomes pelo `PlayerService/GetAllPlayers`. O site liga os nomes aos jogadores (`tsIdOf`), usa-os em `lineupFor` e em `applyChainResults` (fecha dias e acerta usos, `played.ts`), e Grupo → Classificação → "Dia N ›" abre os lineups do dia.

## Historic (sonda de 29 out 2026, `docs/sonda-historic.html`)
- Run `run-fb-historic-2026-10-20` ("HISTORIC - RUN 1 - 2026-27 SEASON", league `simulation`), 11 dias: contests `run-fb-historic-2026-10-20-d1` … `-d11`, locksAt iguais aos do Classic (último jogo do dia). `SearchContests {product:'nba', runId}` lista-os.
- `GetContest {contestId}` → slots (5, sem elegibilidade), objective `lineup_points` (comparator RANK, sem alvo), `slateGames` (12–15 jogos {gameId `run_1_-_26-27_season-gNN`, homeTeamId/awayTeamId NBA, scheduledAt, status}), reward.bands por dia (1.º 4000 … 21–40 100, crédito), `totalEntries`, `callerEntry`.
  - `scoringRubric` (FastBreak Points): PTS 1, REB 1, AST 2, STL 3, BLK 3, TO −1, 3PM 0,5, double-double 5, triple-double 10.
  - `rosterBudget`: limite 350 Roster Points; desconto de colecionador Common/Fandom 5%, Rare 10%, Legendary 15%, Ultimate 20%. `ownershipOptional: true`.
- `GetPlayerSlots {contestId}` → players (~120 = 24 equipas × 5 titulares): playerId, playerName, teamId, rosterPoints (ex.: Hakeem 99, Robinson 95, Iverson 93), ownedMomentFlowIds (as minhas cartas desse jogador), ownershipPct (% de lineups com ele), statAverages/contestStatValues vazios; também slateGames.
- `GetGameBoxScores {contestId}` → games [{game {…, homePoints, awayPoints, status CLOSED}, lines [{playerId, playerName, teamId, minutes "36:00", stats {points, rebounds, assists, steals, blocks, turnovers, three_points_made, double_double, triple_double, fgm/fga, ftm/fta, oreb/dreb, pls_min…}}]}] — dá os resultados simulados de cada lenda nos dias fechados.
- `GetContestStandings {contestId, limit}` → como no Classic, com lineup (playerId + momentFlowId) e `tiebreakerTierSum` / `tiebreakerSerialSum` (as cartas usadas desempatam). Vencedor do d7: 282,5 pontos.
- `SubmitEntry {contestId, slots:[{slotIndex, playerId, momentFlowId?}]}` grava o lineup (parcial também); `DeleteEntry {contestId}` apaga.
- `GetPlayerIntelligence` → `{enabled:true}` só.

## Trocas entre contas (sonda das trocas, 1 nov 2026, `docs/sonda-trocas.html`)
- Oferecer um Moment no Top Shot (testado pelo João): `ProfileService/SearchUserProfiles` (procura a conta de destino pelo nome → dapperId, username, flowAddress) e depois `NFTService/TransferNfts` → `{dapperInvocationId, status}`. **Não abre a carteira Dapper nem pede código/PIN**: só a confirmação na própria página ("tens a certeza?"). Um script dentro do Top Shot pode fazer o mesmo pedido.
- Campos (pelas descrições protobuf no código do Top Shot): `TransferNftsRequest {nft_ids (lista de ids dos Moments = flow id), product (atlas.v1.Product), recipient_flow_address, entity (atlas.v1.Entity)}`; em JSON `nftIds`, `product`, `recipientFlowAddress`, `entity`. `TransferNftsResponse {dapper_invocation_id, status}`. Valores de Product/Entity: a pedir à sonda v3.
- O Top Shot manda o JSON como bytes (Uint8Array) no fetch; as respostas vêm em JSON.
- Outros do NFTService: GetNFT {nftId, product} (para confirmar o dono depois), GetNFTs, SearchNftsByOwner, GetNftOwnershipHistory, BurnNfts, SearchNftsByEdition. No código aparecem `pollTransferStatus`, `useTransferNftsMutation`, `GiftMomentDialog`.
- Regras do Top Shot (2 nov 2026): o Código de Conduta proíbe contas secundárias e bots; as regras do Fast Break excluem entradas feitas por bots. O João decidiu fazer trocas e lineups à mão por agora.

## Blockchain
- O contrato FastBreakV1 não tem nenhuma run NBA 2026-27 (a última é WNBA de junho 2026): a tarefa da blockchain não traz runs nem lineups desta época. A run nova lê-se no Admin → "Run e prémios".
