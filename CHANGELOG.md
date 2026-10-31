# Alterações

O que muda no site, do mais recente para o mais antigo. Cada mudança que entra no `main` acrescenta aqui uma linha
(regras no `CLAUDE.md`): **quem** — o quê, em palavras de quem usa o site (e o n.º do Pull Request, se houver).

## 2026-10-31
- **João** — Historic com descontos de colecionador por conta: a carteira lida no site passa a guardar as cartas de lendas, e cada conta tem o desconto da melhor carta que tem de cada lenda (Common/Fandom −5%, Rare −10%, Legendary −15%, Ultimate −20%); a equipa sugerida de cada conta cabe nos 350 RP com os descontos dela. Para isso é preciso ler a carteira outra vez (Jogadores → Coleção).
- **João** — Cabeçalho: nas abas que não são a Jornada mostra sempre a conta com melhor registo. Classificação do Historic sem a coluna "Dias" e com o texto curto ("Run 1 · lugares há …").
- **João** — Grupo → Classificação com Classic / Historic: no Historic, o lugar de cada conta do grupo em cada dia, o prémio desse dia, quantos dias ficou nos prémios e o total ganho (a coluna das contas já não deixa ver números por trás ao deslizar, também no Classic).
- **João** — Dias já jogados de uma conta sem previsão guardada (ex.: smurf que jogou num dia sem lineup no plano): o lineup mostra o que cada jogador fez, em vez de só os nomes.
- **João** — Jornada: cartão "Os melhores do dia" (ao vivo e nos dias jogados) com o total do teu lineup, o do melhor lineup possível com os teus jogadores e o do melhor na NBA; toca num para ver os 5.
- **João** — Jornada ao vivo redesenhada: o que já se fez em grande com a barra até ao alvo; cada jogador com a sua pista (feito, previsto até ao fim, traço do esperado), ordenados por a jogar / terminados / por começar; dias com duas estatísticas com um número e uma pista por estatística.
- **João** — Ao vivo com smurfs: todas as contas entram ao vivo e são atualizadas juntas de 2 em 2 minutos (antes só a que estava aberta, e as outras ficavam paradas); a atualização periódica já não para se outra coisa falhar.
- **João** — Durante os jogos o lineup levado não muda sozinho (quem ainda não jogou fica; só sai quem não puder jogar). Trocas melhores só nas Sugestões para hoje. Ao vivo: estatísticas da ESPN procuradas pela equipa e uma linha com o que veio ("3 de 5 com estatísticas · Atualizar").
- **João** — Jornada com smurfs: contas lado a lado numa linha (desliza de lado se não couberem) e Lineup · Porquê · Comparar por baixo.
- **João** — iPhone: o cabeçalho começa abaixo da barra de estado (o título deixava de ficar esbatido por baixo dela).
- **João** — A fazer: um grupo por par de contas ("Da Main para a Terose"), sem listas com vírgulas quando há 3 contas.

## 2026-10-30
- **João** — Jornada: o título diz só o modo (Classic / Historic / Pro), sem "Run 1".
- **João** — A fazer, Moments a mandar mais curtos: por conta e uma linha por hora limite ("até 02:00 Reaves · Doncic R · Curry R"); o visto marca a linha toda.
- **João** — A fazer: Moments a mandar agrupados pela conta de onde saem (entra-se numa conta de cada vez), por ordem da hora limite.
- **João** — Cabeçalho com smurfs: por defeito o registo da conta com mais vitórias; ao escolher outra conta na Jornada, passa a mostrar o dessa.
- **João** — Procurar jogadores sem acentos também com letras especiais (ı, ł, ø, đ, ß, æ, œ): "Sengun", "Jokic", "Porzingis".
- **João** — Pro: tocar numa carta a comprar abre o que custa a que conta, quanto vale a tua (ASP) e a diferença; "tens" passa a ser só das tuas cartas (antes apanhava as do grupo); ASP das cartas que já tens.
- **João** — Historic: o leitor (v20) guarda também o lineup de quem lê (vem com o dia) e o erro, se o lugar das contas não vier; o arquivo mostra o que cada leitura trouxe.
- **João** — Admin → Ler no Top Shot: "Classificação, picks, lineups e Historic" num só botão, e "Preços dos jogadores e das cartas (ASP)" noutro.
- **João** — Historic: os dias que acabaram abrem-se na faixa: lugar e lineup de cada conta, a sugestão da app (e onde teria ficado), a melhor equipa possível e as lendas que mais fizeram. Leitor do Top Shot v19 (lê os lineups do Historic).
- **João** — Pro em ensaio na Run 1: cada dia com uma regra inventada (MGLE, Holo Icon, estreias); lineup só com o que tens e as cartas a comprar para ficar competitivo, com preço e a diferença para a carta que já tens. Admin → Ler no Top Shot → **Preços do Pro**.

## 2026-10-29
- **João** — Discord: só lê o que chega dos canais seguidos do Top Shot (a conversa do servidor fica de fora) e só manda para o Telegram o que passa o filtro (`scripts/discord-filter.json`: canais e palavras).
- **João** — Discord → Telegram: as mensagens novas do servidor do grupo no Discord (canais de anúncios do Top Shot seguidos lá) vão para o grupo do Telegram (precisa do segredo `DISCORD_BOT_TOKEN`).
- **João** — Dias sem lineup no Top Shot ficam a 0 (as estatísticas deixavam de lhes pôr o total do lineup sugerido).
- **João** — Historic aprende com todas as runs: a tarefa "Arquivo do Historic" guarda no site os dias jogados (docs/data/historic) e o modelo usa-os; o Historic diz de quantos dias aprende.
- **João** — Jornada → Modo **Pro** (primeira versão): o que é, o que vai mostrar na Run 2 e as cartas que o grupo já tem de Metallic Gold LE, Holo Icon e estreias. Sonda do Pro (`docs/sonda-pro.html`) para ler as regras de cada noite no Top Shot.
- **João** — Dias em que uma conta não levou lineup no Top Shot (não está na classificação do dia): o dia fica sem jogadores, os usos voltam, e na Classificação aparece "—". Leitor do Top Shot v18.
- **João** — Historic com smurfs: uma equipa diferente por conta (juntas, mais hipóteses de pelo menos uma chegar aos prémios). Dias do Historic nos mesmos quadrados da run, com a hipótese de top 40 de cada dia.
- **João** — Jornada: o modo (Classic / Historic) escolhe-se no título, em vez de uma caixa por cima do lineup.
- **João** — Botões "Ler no Top Shot": abrem o site do Top Shot no browser em vez da app deles.
- **João** — Jornada → **Modo: Classic / Historic**. No Historic: a equipa sugerida para cada dia aberto (pontos esperados, hipótese de top 40/top 10/1.º), outras equipas, todas as lendas com fixar/tirar/procurar, a tua carta de cada lenda (desconto), fotos e um 🕊️ RIP para as lendas que já partiram. Admin → Ler no Top Shot → **Historic** traz os dados para o grupo.
- **João** — Dados do Historic (`docs/historic-dados.html`): lê no Top Shot as lendas de hoje e os resultados dos dias que passaram, para sugerir o lineup do Historic.

## 2026-10-28
- **João** — Sonda do Historic (`docs/sonda-historic.html`): grava o que o Top Shot mostra no modo Historic, para preparar o planeador.

## 2026-10-27
- **João** — Mudar o lineup: o × em "Pôr no lineup" tira o jogador desse dia e o plano põe logo o melhor a seguir; "Fora deste dia" com Repor. Diferenças nesta folha em % (não pp).
- **João** — `CLAUDE.md` (regras para trabalhar no repositório com o Claude) e este ficheiro.

## 2026-10-26
- **João** — Prioridade entre contas (Ajustes → Preferências): Automática (a mais bem classificada na Geral), uma conta, ou Iguais.
- **João** — Mudar o lineup: "já joga na …" sem conta passa a dizer que a conta já não tem usos da carta.
- **João** — Durante os jogos: Mudar o lineup levado, mesmo com quem já começou; a app segue esses jogadores.
- **João** — Odds: nos dias de lançamentos e lances livres pede também as linhas de pontos (as casas não têm FGM).
- **João** — Admin → Tarefas: botão "Ler as odds agora" (precisa do `supabase/schema.sql` novo).
- **João** — Lineup de hoje mantido: só troca sozinho se alguém não puder jogar ou se a run ganhar ≥ 2%; Histórico do lineup na Jornada, com Reverter / Fazer esta troca.
- **João** — Dias acertados pelo lineup lido no Top Shot: o total é refeito com as estatísticas desse lineup.

## 2026-10-25
- **João** — Lesões: procura por jogador ou equipa, resto da NBA por equipa, sem o número no separador.
- **João** — Jogadores → Vender: Não usadas (na run toda e quantas runs sem uso), Repetidas, Rara a mais e Poupar; low ask e ASP de cada carta.
- **João** — Forma da run (quentes, frios, minutos, jogos desequilibrados); forma no Plantel e no lineup da Jornada.
- **João** — Plantel sem o botão Adicionar; jogador retirado da NBA fica fora do plano.
- **João** — Telegram: avisos de lesões mais claros; lembrete "Lineups done?"; aviso quando chegam as odds.
- **João** — Jogo seguido só conta se ele jogou na véspera.
- **João** — A fazer: Moment marcado como mandado já conta na outra conta.
- **João** — Leitor do Top Shot: lineups que cada conta levou (dias e usos acertados por eles), run e prémios; Admin com "Classificação e picks" e "Lineups" em separado.
- **João** — Mudar o lineup: Fixar todos / Soltar todos; dia passado com Guardar logo a seguir ao lineup.

## 2026-10-24
- **João** — Dia passado: procura no Mudar; usar um jogador num dia passado tira os cadeados sem usos.
- **João** — Mudar o lineup: procura acima do teclado, voltar ao mesmo sítio, repor quem saiu.
- **João** — Mudar o lineup e Sugestões: hoje e o resto da run em separado; usos e dias de quem pode entrar.
- **João** — Faixa dos dias com ✓/✕; cabeçalho com o registo da conta com mais vitórias.
