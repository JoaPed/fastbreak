# Preços do mercado lidos no Top Shot (22 out 2026, commit 7a74765)

- O script **FB lugares** (docs/fb-lugares.js; o favorito carrega sempre a versão mais recente) lê também os preços quando se toca em **Grupo → Classificação → Atualizar lugares e preços** (ou em «Atualizar no Top Shot» na ficha de um jogador).
- **No Top Shot, com a sessão do utilizador:**
  - `PlayerService/GetAllPlayers` devolve o nome e o id da NBA de cada jogador. Fica em cache 7 dias no localStorage do Top Shot (`fb-tsp`).
  - Os nomes ligam-se pelo mesmo `norm()` do site. Se não houver nome igual, usa o apelido com a inicial, mas só quando há um único jogador assim.
  - Para cada jogador, `EditionService/SearchEditions` com `{product:'nba', tier, hasListings:true, sortByOption:'LOW_ASK', sortByDirection:'ASC', limit:'1', playerId:[nbaId]}` → `lowAskCents`.
  - Uma chamada por escalão: [COMMON, FANDOM], [RARE] e [LEGENDARY, ULTIMATE]. Se a API recusar dois escalões juntos, passa a pedir só o primeiro.
  - Faz 6 pedidos de cada vez. Se um pedido falhar, tenta outra vez com `ownerAddress`.
- **Os jogadores a ler** (`pxWanted`, até 220), por esta ordem: o plantel e a coleção, as sugestões de compra (lista e as 40 primeiras do rank), os 12 melhores em cada estatística dos especialistas (com pelo menos 12 minutos por jogo) e depois os melhores marcadores.
- **Volta ao site** em `#fbranks=…` com `px = {at, p: {id: [Common, Rare, Legendary] em cêntimos ou null}, miss}`.
  - O site guarda isto em `localStorage 'fb-px'`, com a hora de cada jogador em `t`; os preços com mais de 3 dias saem.
  - Publica em `summaries.share.px`. Para cada jogador, o site usa o preço mais recente lido por qualquer pessoa do grupo (`pxIndex`).
- **Onde se usa:** `mktOf` usa primeiro o preço do Top Shot (Rare+ usa a coluna do Rare). Os preços da blockchain (tarefa Mercado) ficam como «aproximado» para os jogadores que ainda não foram lidos.
  - A ficha do jogador mostra «Mercado do Top Shot · há X» e «nenhum à venda».
  - O filtro de preço máximo nas compras também funciona só com estes preços.
- Os campos do edition (vistos na sonda 5) incluem `lowAskCents`, `averageSalePriceCents` (o utilizador não quer o ASP), `tier`, `parallel`, `set.name`, `maxMintSize` e `editionTemplate.metadata.PlayerId/FullName`.
- **Por confirmar no primeiro uso real:** o corpo do pedido do GetAllPlayers e se aceita vários escalões numa só chamada (os dois casos já têm alternativa no código).

## Oferta mais alta e custo real (13 nov 2026, leitor v35)
- A mesma chamada que dá o mais barato à venda (`SearchEditions`, `limit: 1`, por `LOW_ASK`) traz `highestOfferCents` dessa
  edição. O leitor passa a devolver, por jogador, `[3 preços, 3 ofertas]` (Common, Rare, Legendary). Uma oferta igual ou
  acima do preço fica de fora. Quem ainda tem o site antigo lê só as 3 primeiras colunas.
- **Custo real** (`costOf` no `docs/app.js`): preço − oferta × (1 − 5% de comissão), com mínimo de 5% do preço. Sem
  oferta lida (ou linha antiga, de 3 colunas), o custo é o preço todo.
- Onde entra: a escolha do escalão ("Qualquer"), a ordem "Mais por dólar", o "por dólar" de cada linha e a escolha do
  carrinho. O **orçamento** ("Tenho para gastar") e o "Máximo por Moment" continuam a contar o preço que se paga.
- É uma estimativa: a oferta é a dessa edição no momento da leitura e pode sair antes de se vender.
- Com preços lidos mas sem ofertas (leitor antigo), o formulário das compras pede a v35.

