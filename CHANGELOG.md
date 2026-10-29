# Alterações

O que muda no site, do mais recente para o mais antigo. Cada mudança que entra no `main` acrescenta aqui uma linha
(regras no `CLAUDE.md`): **quem** — o quê, em palavras de quem usa o site (e o n.º do Pull Request, se houver).

## 2026-10-29
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
