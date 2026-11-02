# Picks do Fast Break (sondas de 23 out 2026)

## O que a sonda mostrou

- **Página:** `/progression/picks`.
- **Serviço:** `atlas.v1.PredictionService`.
  - `ListPredictionEvents` com `{product:'nba'}` devolve os picks abertos do dia (`status:'open'`). Com `status:'locked'` vem vazio.
  - `GetUserPredictionSummary` devolve os pontos do próprio utilizador. Campos: `dailyActivePointsCap` (100), `dailyActivePointsUsed`, `dailyActivePointsRemaining`, `freePicks:true`, `daysUntilBonus`, `wins`, `losses`, `currentStreak` e `bestStreak`.
  - `ListUserPredictions` devolve os picks feitos. Pedido: `{product:'nba', status:'complete', limit:'20', offset:'0'}`; sem `status` devolve os pendentes.
  - `GetPredictionLeaderboard` devolve a classificação da época. Pedido: `{product:'nba', limit:'50'}`. Campos de cada entrada: `seasonalPointsEarned`, `tierName` (por exemplo «Legend»), `wins`, `losses`, `currentStreak` e `rank`.

## Estrutura de um pick

| Parte | Campos |
|---|---|
| Evento | `eventId`, `pickType`, `description`, `lockTime`, `status`, `maxPoints`, `multiplier` (2), `correctOptionId`, `totalEntries`, `stakeAtRisk` |
| Evento: `metadata` | `home_team` e `away_team` (`alias`, NBA id em `reference`), `scheduled` |
| Opção | `optionId`, `label`, `metadata` (id NBA, `stat_key`, `side`, `threshold`), `pickCount`, `pickPercentage`, `liveScore` |
| Pick do utilizador | `pointsSubmitted`, `status` (won/lost), `pointsAwarded`, `stakeAtRisk` |

## Tipos de pick (`pickType`)

- `game_winner`: que equipa ganha.
- `player_duel`: qual de dois jogadores marca mais pontos.
- `player_over_under`: o jogador faz mais ou menos de uma linha (por exemplo 19.5 pontos).

## Regras vistas nos resultados

- **Ganhar:** `pointsAwarded` = 2 × pontos apostados.
- **Perder:** com `stakeAtRisk:false` devolve os pontos apostados. Exemplo: 250 apostados, perdeu, recebeu 250.
- **Consequência:** se o risco for zero, compensa escolher sempre a opção mais provável e pôr todos os pontos do dia no pick mais seguro.
- **Limites (outubro de 2026):** 100 pontos por dia no total e 100 por evento. Nos playoffs eram 1000 por evento.

## No site (desde o commit 66b9adc)

- **Leitura:** o script FB lugares (versão 8) lê os picks abertos com o «Atualizar» do admin e guarda-os em `share.picks`. O site usa o documento mais recente do grupo.
- **Jornada:** mostra só o «Pick do dia», o favorito mais seguro, com as odds mais baixas, para dobrar os pontos. Decidido pelo João a 23 out.
  - Em `game_winner`, a probabilidade sai das linhas de vitória que a ESPN mostra (moneyline; sem ela, pelo spread com desvio de 12 pontos).
  - Em `player_over_under` e `player_duel`, sai das nossas odds de pontos por jogador.
  - Sem odds, a escolha é pela % do pessoal.
- **Pontos de cada um do grupo nos picks:** testado e abandonado a 23 out. O João disse que não valia a pena.
