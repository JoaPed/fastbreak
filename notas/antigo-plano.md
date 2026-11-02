# Plano — App de equipas para runs do Fastbreak (NBA Top Shot)

Atualizado: 10 out 2026. Época NBA 2026-27 começa a 20 out 2026 → primeira run deve arrancar aí.

## 1. Regras em que o plano assenta (confirmadas)
- 5 jogadores por noite; cada noite tem objetivo(s) diferentes (Classic: ex. "≥140 pontos combinados"; Pro: vários stats ao mesmo tempo, ex. "45 assistências e 7 roubos").
- Runs de ~11 dias. Objetivos de todos os dias conhecidos no início (segundo o utilizador).
- Fadiga: nº de usos por run depende do preço médio de venda (ASP) do Moment, desde 2025-26. O utilizador indica os usos.
- Leaderboard da run = total de vitórias; desempate = posição média nos leaderboards diários.
- Modos: Classic, Pro (exige coleções/badges específicos), Historic (simulação).

## 2. Funcionalidades
1. Configurar a run: dias, objetivo(s) de cada dia (colar texto ou foto do ecrã), jogos de cada dia.
2. Plantel: jogadores + usos restantes (em linguagem natural: "Jokic 2, Tatum 3", ou editar na lista).
3. Probabilidades por jogador/dia: linhas mais/menos (pontos, ressaltos, assistências, triplos, roubos, desarmes) → distribuição de cada stat. Dias sem odds ainda → projeção por médias, minutos e adversário.
4. Plano da run inteira: 5 jogadores por dia, P(vitória) por dia, vitórias esperadas na run. Respeita usos e quem joga em cada dia; guarda estrelas para os dias difíceis.
5. Ajustes: mudar usos, fixar/excluir jogador, lesões → replaneia só os dias que faltam.
6. Modo "tudo pelo próximo dia": maximiza o próximo dia ignorando o futuro e mostra o custo ("vitórias esperadas no resto da run: 6,1 → 5,3"). Opção intermédia com peso hoje vs. resto.
7. Diário: registar resultado do dia e usos gastos → recalcula. Sugere modo diário quando o prémio da run já está fora de alcance.
8. Mais tarde: histórico previsão vs. resultado (calibração), importação da coleção.

## 3. Dados
| Dado | Fonte | Notas |
|---|---|---|
| Objetivos | Utilizador (texto ou captura de ecrã lida pelo Claude) | Sem API oficial do Fastbreak |
| Jogadores e usos | Utilizador | Importação via API GraphQL do Top Shot fica para depois (não acessível a partir do ambiente do Claude) |
| Calendário NBA | Claude recolhe ao configurar a run | |
| Linhas de props | Opção A: Claude recolhe linhas públicas via pesquisa web (grátis, já funciona; a pedido ou tarefa agendada diária). Opção B: The Odds API (mercados player_points/rebounds/assists/threes/blocks/steals…; grátis 500 créditos/mês, pago desde 30 USD/mês por 20k) — testar se a app chama a API direto do browser | Começar com A |
| Lesões/estado | Claude ao atualizar odds | Jogador "questionável" é penalizado |

Limitação: props só saem ~1 dia antes do jogo → plano da run usa projeções para dias distantes e é recalculado todos os dias com odds reais.

## 4. Método
- Linha + odds → probabilidade implícita sem margem da casa → média/distribuição por stat (pontos ~normal; triplos/roubos/desarmes ~Poisson).
- Soma das 5 → P(total ≥ alvo). Objetivos múltiplos (Pro) → simulação Monte Carlo.
- Otimização: lineups de todos os dias a maximizar a soma das P(vitória) com limite de usos (busca local / programação inteira no browser).

## 5. Arquitetura
- App privada no claude.ai (abre no telemóvel), com base de dados própria: run, objetivos, plantel, usos, odds, planos, resultados.
- Cálculos na própria app (instantâneos ao mexer nos usos).
- Claude integrado na app para pedidos em linguagem natural e leitura de capturas.
- Atualização de odds pelo Claude (chat ou tarefa agendada ao fim da tarde, antes do fecho) a escrever na base de dados da app.

## 6. Fases
1. MVP (antes de 20 out): run manual, plantel/usos, projeções + odds, otimizador da run, modo próximo dia, ajustes.
2. Odds automáticas diárias + leitura de capturas.
3. Pro multi-stat refinado, registo de resultados/calibração, importação da coleção.

## 7. Decisões em aberto
- Classic, Pro ou ambos?
- Como é ordenado o leaderboard diário (total da stat? margem acima do alvo?) — define o que o modo "próximo dia" maximiza.
- Odds: recolha pelo Claude (grátis) ou The Odds API (chave própria)?
