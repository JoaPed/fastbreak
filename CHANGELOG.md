# Alterações

O que muda no site, do mais recente para o mais antigo. Cada mudança que entra no `main` acrescenta aqui uma linha
(regras no `CLAUDE.md`): **quem** — o quê, em palavras de quem usa o site (e o n.º do Pull Request, se houver).

## 2026-11-13
- **Pedro** — Ler carteira: o resultado diz logo quantos Moments estão trancados e de que jogadores (por conta), ou avisa se não deu para ver os trancados.
- **João** — Moments trancados (lock de 1 ano no Top Shot): ao ler as carteiras, o site vê quais estão trancados. Esses nunca entram nas transferências nem no "A fazer", não aparecem no Vender e cada conta só os joga se os tiver; a ficha do jogador marca-os como "trancado". Quem tem Moments trancados (ex.: o Pedro) tem de ler a carteira outra vez (Jogadores → Coleção → Ler carteira).
- **João** — Comprar pelo **custo real**: o leitor (v35) lê também a oferta mais alta de cada Moment à venda, e "Mais por dólar" passa a contar o que perdes — o preço menos o que recebes ao revender à oferta (com os 5% de comissão). Um Rare de 20 $ com oferta a 17 $ custa cerca de 4 $. Cada linha mostra o preço e o custo real; "Tenho para gastar" continua a contar o preço que pagas. Precisa de atualizar o leitor e ler os preços outra vez.
- **João** — Corrigido: com um lineup de hoje incompleto (poucos usos, o plano guarda jogadores para outros dias), o site podia ficar a trocar sozinho entre dois lineups sem parar, a gravar o plano de cada vez. Agora troca uma vez e fica; o histórico do dia perde as voltas repetidas.
- **João** — Plano com poucos usos: a pesquisa passa a **mudar um jogador de dia** (sai de um dia onde pesa pouco e fecha o lineup de outro). Antes espalhava usos por dias perdidos; em rosters curtos (smurfs) o plano junta-os em lineups completos e ganha mais dias. Com usos de sobra fica igual.
- **João** — Comprar por valor: com os preços lidos no Top Shot, a lista escolhe para cada jogador o **escalão que mais rende por dólar** (Common, Rare ou Legendary), mostra o preço e o que a run sobe por dólar, e ordena por aí (ou só pelo ganho). Novo campo **Tenho para gastar**: a app monta o conjunto de compras que cabe nesse valor e refaz a run com todas juntas.
- **João** — Estimativas afinadas com 30 mil jogos reais: objetivos ligados (FGM + FGA, 3PM + 3PA) contam como um só, a forma pesa conforme a estatística, sem quebra nos jogos seguidos, e os colegas de quem falta sobem (suplentes mais do que titulares); quem volta de paragem conta menos no 1.º jogo. "Em que se baseia" explica cada passo.
- **João** — Aspeto: linhas de compra mais curtas (escalão, preço e ganho por dólar), uma só linha entre jogadores no cartão do lineup, botão "Sugestões" numa linha, listas do Plantel e da Forma sem quebras a meio; percentagens em % onde ainda dizia "pp".

## 2026-11-12
- **João** — Nova tarefa manual "Dados para medir o motor": junta jogos reais, odds já lidas e os dias das runs para testar as estimativas do site contra o que aconteceu (não muda nada no site nem gasta créditos).

## 2026-11-10
- **João** — "Se não jogar: …" e as dicas de baixas já não sugerem quem a carta põe a jogar noutra conta nessa noite (ex.: o Booker, que joga na JPolas).
- **João** — Lesões e forma: nova secção **Sobem com as baixas** — quem faz bem mais do que o costume nos jogos em que falta um colega habitual que hoje está fora (ex.: sem o Sabonis, os ressaltos do Achiuwa), com os usos que tens; a dica aparece também na lista do "Mudar lineup". A tarefa das estatísticas passa a juntar estes números desde o início da época. "Fora deste dia" tem um botão **Repor todos** no fim.

## 2026-11-09
- **João** — Lineup: quando um jogador já não tem usos nesta conta, o aviso diz quantas vezes já jogou e em que dias o plano o usa (antes falava da outra conta, o que confundia).
- **João** — As estatísticas e médias da NBA passam a atualizar três vezes por manhã (07:13, 09:17 e 12:13 UTC): o GitHub andava a atrasar a tarefa das 09:17 até à tarde, e os jogos da noite só entravam ao fim do dia.

## 2026-11-08
- **João** — Histórico do lineup: só mostra as trocas da conta em que estás.
- **João** — Lineup com várias contas: já dá para pôr quem a carta põe a jogar noutra conta nessa noite (ex.: o Gobert na principal quando estava na Terose); a outra conta larga-o, o plano dá-lhe outro e o aviso lembra de mudar lá no Top Shot. Quem ainda não jogou esta época, não está nas lesões e não tem odds (ex.: Westbrook, retirado mas ainda num plantel da ESPN) fica fora do plano.

## 2026-11-07
- **João** — Historic → Comprar: quando nenhuma carta muda o prémio, uma nota diz porquê (em quantos dias já estavas no top 40 e quanto faltou no dia mais perto de entrar, contra o que o desconto dava).
- **João** — Historic: separadores Equipa / Lendas / Comprar. Em **Comprar** ("Vale a pena comprar?"), para a conta principal: que carta de cada lenda (Common −5%, Rare −10%, Legendary −15%, Ultimate −20%) te dava mais pontos, quantos dias no top 40 e o prémio a mais, com o preço da carta; conta os dias desta run e os das runs anteriores. Quem tem uma só conta não vê "outras equipas" com mais pontos que a sugerida. Cada lista tem um botão para minimizar. Leitor v34: lê os preços das cartas das lendas.
- **João** — Mudar o lineup: o × solta logo o cadeado ("manter" volta a pô-lo); se fechares sem escolher quem entra, quem saiu fica fora do dia e o plano põe o melhor a seguir; a contagem de fixados só conta quem está no lineup e joga nesse dia.
- **João** — Histórico do lineup: as mudanças feitas por ti e as trocas de quem fica de fora mostram o efeito na run (run +X% / −X% nas vitórias esperadas), como as trocas que o site propõe.
- **João** — Pro: o site usa a leitura mais recente das regras da Pro que bata com a run; uma leitura de outra run (de qualquer pessoa do grupo) já não faz voltar ao ensaio. As Sugestões avisam quando não há preços para o dia.

## 2026-11-06
- **João** — Mudar o lineup: o cadeado de quem não joga nesse dia (lesionado, sem jogo) já não conta para os 5 fixados nem bloqueia as trocas, e sai quando mexes nos cadeados.
- **João** — Pro: "O que já tens para o dia N" mostra só as tuas cartas que contam nesse dia, com o low ask, a conta, a projeção e se servem (na sugestão, útil, pouco útil, sem jogo).
- **João** — Pro: o placar do dia segue o teu lineup (quanto custa à esquerda e a vitória no anel). Botão "Sugestões" com três lineups (Barata, Equilibrada e A melhor), com a vitória e o custo total, e "Usar a …".
- **João** — Classificação: separador Pro (só as contas principais), com o lugar na run e em cada dia e os créditos ganhos. O leitor (v33) lê-a com os lugares.
- **João** — Vender: filtro "Vendas rápidas" (conta com a oferta mais alta em vez do low ask, mostra quanto recebes e, ao carregar, quanto perdes face a esperar pelo low ask).
- **João** — Pro: "Mudar o lineup" como no Classic (no placar e no cartão Equipa). A folha tem × para tirar, "Adicionar jogador" com "manter" e "Voltar à sugestão". O «Quem entra?» mostra logo o low ask de cada jogador. A faixa tem a run toda: os dias passados mostram a equipa que escolheste.
- **João** — Pro: cartão Equipa no dia, como o lineup do Classic. Mostra as tuas cartas que contam e as que podes comprar (com o preço desse dia), o total a gastar e as cartas que estão noutra conta e têm de ir para a principal (só a principal joga o Pro). Tocar num jogador mostra a carta (low ask) e "Trocar" abre o «Quem entra?», com a vitória da equipa com cada um. Também há a troca rápida: vender a tua da mesma raridade pela oferta mais alta e comprar a do dia.
- **João** — Vender: a oferta mais alta (vendes já) em todas as listas e na folha de cada troca.
- **João** — Leitor v32: preços do Pro por dia (a carta mais barata que conta pela regra de cada dia, set e escalão ou emblema) e a oferta mais alta de cada edição nas Cartas (ASP).
- **João** — Vender → Repetidas: por raridade (dois Commons, dois Rares…) e só as cartas que o plano não usa; as mais raras primeiro. Um Rare e um Common do mesmo jogador já não são repetidas.
- **João** — Pro: os dias com emblema (Rookie Year, Top Shot Debut…) contam as cartas que têm esse emblema. O leitor (v31) lê os emblemas de cada carta com as Cartas (ASP) no Admin.
- **João** — Vender → Poupar e Rara a mais: as cartas à venda contam outra vez os usos pela raridade (Rare 2, Legendary 4); antes só contavam pelo ASP e quase não apareciam trocas.
- **João** — Vender: "preços há …" conta com a leitura de preços de quem a fez no grupo (dizia "por ler" a quem não leu).
- **João** — Jornada: a ficha de cada jogador tem "Cartas" (as tuas cartas dele, em que noites cada conta o usa, "Ver se compensa um 2.º Moment" e o mercado).
- **João** — Vender → Poupar com Filtros (botão por cima da lista): aceitar raridade mais baixa (desligado), contar usos pelo ASP com folga (ligado) e mostrar subidas de raridade sem pagar mais (desligado).
- **João** — Vender → trocas mais seguras: a carta comprada tem de dar os usos pelo escalão, ou pelo ASP com folga (o dobro do mínimo da faixa); só aparecem poupanças de pelo menos $3 e 25% do preço.
- **João** — Leitor v30: a leitura de todos os dias traz os packs da run (5, 9, 12 vitórias) e o site acerta sozinho os patamares (prémios, sugestões, compras, gráfico).

## 2026-11-04
- **João** — "Run e prémios" acerta os patamares de vitórias de uma run que já está no site para os packs do Top Shot (5, 9, 12), em vez dos da run anterior.
- **João** — Ajustes → Preferências → Jogar para: cada conta escolhe entre os prémios da run (como até agora, por defeito), a classificação (o máximo de vitórias) ou um patamar (5V, 9V, 12V) com o menor risco. Jornada sem "Enviar no Top Shot" (as trocas mandam-se na Coleção). "Muda noutros dias" com um dia por linha, caras de quem sai e entra e a vitória desse dia.

## 2026-11-03
- **João** — Link joaped.github.io/fastbreak/#ler: abre o site e começa sozinho a leitura de todos os dias no Top Shot (admins), para uma automatização dos Atalhos do iPhone às 7:00.

## 2026-11-02
- **João** — Pro a sério (leitor v29): o "Run e prémios" e os "Preços do Pro" leem os dias do Pro com os objetivos e as cartas que contam (sets e escalões, ou emblemas); a Jornada → Pro deixa de ser ensaio. Saiu o aviso "Run lida no Top Shot" do Admin.
- **João** — Leitor v28: tenta outra vez quando um pedido ao Top Shot falha por rede (um dia podia ficar sem objetivos).
- **João** — Sonda dos objetivos, versão 2: pede o pormenor de cada dia da run nova (Classic e Pro) e mostra os objetivos de cada um.
- **João** — Leitor v27 e "Run e prémios": a run nova traz os patamares de vitórias do Top Shot (packs aos 5, 9 e 12 vitórias) em vez dos da run anterior.
- **João** — Sonda dos objetivos (docs/sonda-objetivos.html): favorito que só lê, para ver onde o Top Shot dá os objetivos dos dias da run nova.
- **João** — Leitor v26: lê os objetivos de cada dia da run nova e acha a run nova do Historic, mesmo pela parte pública do Top Shot.
- **João** — O plantel é o mesmo em todas as runs: a run nova traz-o sozinha (sem aviso), com os usos todos de volta; só muda quando alguém lê a carteira.
- **João** — Classificação por runs: em Grupo → Classificação escolhe-se a run numa lista (Classic e Historic); a Run 1 mostra-se com os lugares, os dias e o dinheiro ganho. O site abre sempre na run atual e "Atualizar com o Top Shot" lê sempre a run atual. Leitor (v25) acha a run nova mesmo sem a lista das runs ativas.
- **João** — Pasta `notas/` com o que o Claude foi aprendendo (API do Top Shot, regras de usos, picks, preços, história do site), para qualquer Claude que trabalhe no site.
- **João** — FB lugares: a página mostra a versão atual do leitor e a caixa laranja no Top Shot também (v24), para saberes se tens o script certo.
- **João** — Atualizar com o Top Shot já não fica parado em “Toca em Leaderboard”: lê pela parte pública do Top Shot, sem precisar da sessão (só as trocas precisam). Script automático na versão 24.
- **João** — Sonda da sessão (docs/sonda-sessao.html): favorito que só lê, para ver porque o leitor fica parado em “Toca em Leaderboard” e se ainda se lê a Run 1.
- **João** — Atualizar com o Top Shot lê a run do site (pelo 1.º dia), mesmo com a Run 2 já a decorrer: dá para ler os resultados da Run 1 que acabou. Script automático na versão 23.
- **João** — Sonda das runs, versão 2: anota todos os pedidos da página desde o início (também GraphQL do Fast Break antigo).
- **João** — Sonda das runs (docs/sonda-runs.html): favorito que só lê, para ver como o Top Shot mostra uma run que já acabou (runs ativas e pedidos da página ao abrir a Run 1 e a classificação).
- **João** — Ler no Top Shot abre a página do Fast Break da NBA (nbatopshot.com/fastbreak?league=nba; a /fastbreak sozinha ia para o /play, vazio sem run a decorrer). O leitor (v22) lê os lugares de uma run que já acabou (e do Historic) pela run que o site já conhece.
- **João** — Plantel → ficha do jogador → As tuas cartas: "Mandar…" em cada carta, para a mandar para outra conta pelo script do Top Shot (só manda depois de "Enviar"). Run acabada: a Jornada abre no último dia e continua a dar para andar por todos os dias, com o resumo por cima.

## 2026-11-01
- **João** — Trocas entre contas pelo script do Top Shot: no A fazer, "Enviar no Top Shot" em cada conta de onde saem Moments; o leitor (FB lugares, userscript v21) mostra a lista, só manda depois de "Enviar" (NFTService/TransferNfts, como quando ofereces à mão), confirma que cada Moment estava na conta e chegou à outra, e volta ao site com as trocas marcadas como feitas.
- **João** — Sonda das trocas, versão 2: vê também os campos do pedido que manda o Moment (o Top Shot manda-o com NFTService/TransferNfts, sem abrir a carteira).
- **João** — Sonda das trocas (docs/sonda-trocas.html): favorito que só lê, para ver como o Top Shot manda um Moment para outra conta (pedidos no código e os que a página faz quando se oferece um à mão, sem valores nem autorização).
- **João** — A fazer → trocas entre contas: cada Moment com a foto, o nome completo e a hora limite por cima; sem os textos por baixo ("No Top Shot: …" e "Depois: …").

## 2026-10-31
- **João** — Tarefa "Arquivo do Historic": diz também, por conta, quantas lendas do Historic têm carta na carteira lida no site (para confirmar os descontos sem pedir a ninguém).
- **João** — Comprar: as sugestões contam com o dia de hoje (antes dos jogos, o lineup de hoje guardado já não prende quem se compra agora; antes só apareciam dias seguintes). Os prémios de cada conta com os patamares dela, sem os alvos que o plano inventa quando já não há prémio ao alcance (a smurf com 1 vitória a 2 dias do fim já não aparece com "6 vitórias"); o mesmo nos aros de Run → Contas. O texto de progresso não desaparece se a página se redesenhar a meio.
- **João** — Vender → Poupar: só sugere trocar por uma carta que dê pelo menos os mesmos usos, de qualquer raridade (uma Fandom que dá 3 usos pelo ASP já não aparece para trocar por uma que dá menos); quando a que compras é de outra raridade, diz qual ("compras uma Rare por $7").
- **João** — Plantel → As tuas cartas: o preço de cada carta numa linha própria (ASP e a mais barata à venda), sem ficar cortado. Pro: o valor da tua carta vem da edição certa (série, set e tiragem), não do nome do set (um Base Set de 60 000 deixava de valer como um de 2019). Historic: entre os pontos e as lendas fica só uma linha (top 10, 1.º e quanto faz o 40.º).
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
