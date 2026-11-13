# Motor medido contra jogos reais (novembro de 2026)

O que o motor (`docs/core.js`) assume sobre médias, dispersão e objetivos foi posto à prova com jogos reais. Este
ficheiro guarda o que se mediu, para ninguém voltar a afinar números "a olho".

## Dados
- Tarefa manual **Dados para medir o motor** (`.github/workflows/dados-motor.yml`, `scripts/backtest-data.mjs`):
  junta os jogos de cada jogador em duas épocas (registo de jogos da ESPN), as odds já lidas (`odds_days`), os dias
  das runs e os lineups jogados (sem conta nem nome). Escreve `dados.json.gz` no ramo `dados-motor` (fora do site).
- Medição de 12 de novembro de 2026: 30 573 jogos de jogadores (26 776 de 2025-26, 3 797 de 2026-27), 23 dias de
  odds (2 381 linhas), 226 lineups jogados pelo grupo.
- A ESPN não dá ressaltos ofensivos no registo de jogos: os dias com OREB/DREB/PIP ficam fora das contas.

## O que se mediu e o que mudou no motor

| Tema | Antes | Medido | Agora |
|---|---|---|---|
| Objetivos ligados (ex.: FGM + FGA) | produto das probabilidades | correlação no mesmo jogador: FGM–FGA 0,77, 3PM–3PA 0,70, PTS–FGM 0,93, REB–AST 0,19; entre jogadores diferentes < 0,03 | probabilidade conjunta (normal bivariada); em lineups de teste FGM+FGA: previsto 27% → 39%, real 39% |
| Dispersão (variância ÷ média) | PTS 2,0 · FGM 1,0 · FGA 1,1 · FT 1,3 | PTS 3,0–3,3 · FGM 1,25 · FGA 1,45 · FT 2,0–2,3 · REB 1,4 | valores medidos; com linha das odds ×0,95 |
| Forma (últimos 10 / últimos 5) | 30% / 20% em tudo | pontos 25/10, ressaltos 5/13, triplos 15/4, roubos 3/3, desarmes 5/4 | peso por estatística (`STATS.fw`) |
| Época passada na média | (10 − jogos) jogos, zero depois de 10 | variação de jogo ÷ mudança real entre épocas: PTS 5, REB 9, AST 6, 3PM 7, STL 20, BLK 19, TOV 11 jogos | `PRIOR_K` em `scripts/lib.mjs` (na tarefa das estatísticas) |
| Jogos seguidos | −3% | quem joga rende o mesmo (PTS +1%, REB −1%, MIN 0%); joga 87–91% contra 93% num dia normal | sem quebra por defeito (fica o histórico de cada jogador) |
| Adversário | 50% do desvio, ±10% | PTS/FGM 65%, REB/AST/FGA 50%, STL 40%, 3PM/BLK 30% | por estatística (`STATS.opp`), ±12% |
| Minutos altos | nada | 33–36 min: −2%; 36+: −3,5% face à média | `minutesDisc` |
| Topo das estatísticas raras | nada | os 8 melhores de cada dia: desarmes 0,75, roubos 0,70, triplos 0,83 do previsto | `TOP_SHRINK` + época passada (ficam em 0,97 / 0,97 / 0,91) |
| Colegas que faltam | nada | a produção em falta reparte-se: titulares absorvem ⅓ da sua parte, suplentes mais do que a sua parte | `STATS.ctx`, `opts.mates`; menos 2–9% de erro nos jogos afetados |
| Regresso de paragem | só a probabilidade de jogar | 1 jogo falhado: −5% · 2–3: −8% · 4+: −14% (minutos −9% a −25%); 2.º jogo: metade | `backOf` |
| Odds: estatísticas pequenas | média direta da linha | o "mais" sai 45,5% quando as odds dizem 49,3%; média real 7% abaixo em 3PM/STL/BLK | probabilidade −2,5% antes da conta (Poisson); as grandes ficam na linha |
| "Tudo pelo dia" | maior teto (percentil 90) | — | maior probabilidade de cumprir o dia |

Coisas medidas que **não** mexeram: casa/fora (±0,5%, só os desarmes passam de 2%), descanso de 2+ dias, binomial
negativa para totais pequenos (a normal com correção de continuidade calibra igual), correlação entre colegas.

## Resultado (o mesmo teste nos dois motores)
- **Decisão sem odds** (dias futuros): para planteis ao acaso de 15 jogadores, cada motor escolhe o lineup que acha
  melhor. Desde 3 de novembro: o novo ganha **36,8%** dos dias, o antigo 35,2% (+1,6% ± 0,8%); a época toda 30,9%
  contra 30,2%. O novo também promete menos do que não cumpre (dizia 38,8% → saiu 36,8%; o antigo 39,5% → 35,2%).
- **Com odds** (o dia de jogo): iguais dentro do erro (36,6% contra 36,2%). Com odds o motor já estava calibrado.
- **Lineups do grupo** (205): previsto 57,2% e real 52,7%, contra 57,6% do motor antigo.

## A pesquisa do plano (13 de novembro)
Ao ver as Sugestões para hoje, uma alternativa ("guardar o Şengün") dava mais vitórias do que o plano: a pesquisa
só sabia trocar um jogador por um livre no mesmo dia, ou trocar dois jogadores entre dois dias. Com todos os usos
gastos (o normal em rosters curtos) não conseguia **mudar** um jogador para um lugar vazio de outro dia.

- Novo passo "mudar de dia" (uma conta e várias): o jogador sai de um dia (entra o melhor livre, ou o lugar fica
  vazio) e entra noutro (lugar vazio ou no de outro). Só corre quando já não há melhorias simples, por isso o caminho
  até aí é o de sempre e o resultado só pode subir.
- Medido em cenários ao acaso a partir do fixture (o mesmo modelo, só muda a pesquisa):

| Cenário | Antes | Agora |
|---|---|---|
| Uma conta, poucos usos (80) | 1,95 vitórias esperadas | 2,25 · melhor em 70, pior em 0 |
| Uma conta, usos de sobra (40) | 5,145 | 5,146 · melhor em 3, pior em 0 |
| Duas contas, poucos usos (50) | 2,23 | 2,38 · melhor em 42, pior em 0 |
| Duas contas, usos de sobra (16) | 8,28 | 8,34 · melhor em 13, pior em 1 (−0,3%) |

- Tempo: uma conta igual; duas contas +12% a +15%.
- Uma pesquisa 5 vezes mais longa só encontra planos ~0,7% melhores: daqui para a frente o ganho está no modelo, não
  na pesquisa.

## Como repetir
1. Correr a tarefa "Dados para medir o motor" no GitHub (Actions) e ir buscar `dados.json.gz` ao ramo `dados-motor`.
2. As contas desta medição foram feitas fora do repositório (Python e Node sobre esse ficheiro, com o `core.js`
   antigo e o novo lado a lado). Para repetir: lineups ao acaso de quem jogou em cada dia, probabilidade do motor
   contra o que aconteceu (Brier, calibração por intervalos) e o teste de decisão descrito acima.

## Avisos
- O arranque da época engana: nos primeiros jogos quem tinha muitos minutos na época passada rende 82–95% dessa
  média (papéis que mudam). O motor não corrige isto de propósito (passa sozinho ao fim de ~10 jogos).
- 23 dias de odds é pouco: o que depende das odds (desconto nas pequenas, dispersão com linha) deve ser medido
  outra vez com mais dias.
