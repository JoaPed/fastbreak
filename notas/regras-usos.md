# Fast Break — regras de usos e contas (corrigidas a 21 out 2026; ASP a 23 out)

Fonte: blog oficial do NBA Top Shot (Fast Break All-Star Run e Rookie Run), mais as decisões do João a 23 out.

1. **Os usos são por jogador e por conta, para a run toda.** Não voltam ao início em cada dia. Só voltam a zero numa run nova.
2. **O número de usos é o da melhor carta que a conta tem desse jogador.** Cada carta tem os usos da raridade, que o ASP pode subir (ver abaixo).
3. **Cartas repetidas não dão mais usos.** "Se tiveres 10 Commons de um jogador, só o podes jogar uma vez." Os usos não são por Moment: não há uma "carteira de usos" por carta. "Fast Break will prioritize the Moment that has the most usages."
4. **Cada Moment só joga por uma conta em cada noite.** Pode mudar de conta (oferecido ou vendido) durante a run, mas não na mesma noite.
5. **Consequência:** a k-ésima jogada de uma conta com um jogador precisa de uma carta com pelo menos k usos nessa conta, nessa noite.
   - A 1.ª jogada pode ser com qualquer carta.
   - A 2.ª precisa de uma carta com 2 usos ou mais.
   - E assim por diante.

## Usos de cada carta: raridade + ASP (decidido a 23 out)

- **Mínimo pela raridade:**
  - Common/Fandom: 1 uso.
  - Rare: 2 usos.
  - Legendary: 4 usos.
  - Ultimate: ilimitados.
- **O ASP (average sale price da edição) só conta para subir os usos, nunca para descer.** As faixas são:

| Faixa | ASP | Usos |
|---|---|---|
| Draft Pick | $0.01 – $10 | 1 |
| Starter | $10.01 – $50 | 2 |
| All-Star | $50.01 – $300 | 3 |
| MVP | $300.01 – $1000 | 4 |
| Hall of Fame | $1,000.01+ | ilimitados |

- Exemplos:
  - um Rare com ASP de $60 tem 3 usos;
  - uma Legendary com ASP de $40 tem 4 (a raridade manda);
  - uma Common com ASP de $20 tem 2.
- **ASP de $0.00 é ignorado** (edição sem vendas). Nesse caso conta só a raridade. Decidido com o João a 23 out.
- **Pode mudar a meio da run, se o ASP mudar.** Os usos já gastos mantêm-se e o total passa a ser o novo.
- **Vários Moments do mesmo jogador:** fica tudo igual, conta a carta com mais usos (regras 2 e 3).
  - Exemplo: 3 Commons e 1 Legendary dão 4 usos em cada conta.
  - A partir da 2.ª jogada de cada conta, essa jogada tem de ser feita com a Legendary.
- **Leitura:** é o mesmo botão «Atualizar no Top Shot» (só o admin), com a mesma chamada dos preços (`EditionService/SearchEditions` → `averageSalePriceCents`), mas por edição dos Moments do grupo.
- **Usos postos à mão:** fazem reset quando isto entrar, mas a opção mantém-se para exceções.

## Exemplos

- **1 Common, 2 contas:** 1 uso em cada conta, em noites diferentes. Total 2.
- **2 Commons, 2 contas:** 1 uso em cada conta. Podem ser na mesma noite, uma carta para cada conta. Total 2. Não são 4: a segunda carta não dá mais usos.
- **1 Rare + Commons, 2 contas:** 2 usos em cada conta, total 4. Numa noite pode jogar a conta A com o Rare e a conta B com um Common, se for a 1.ª jogada de B. A 2.ª jogada de cada conta precisa do Rare, por isso dá 4 usos em 3 ou 4 noites.
- **1 Legendary, 2 contas:** 4 usos em cada conta, total 8. Uma conta por noite, porque só há uma carta.

## No site (desde b174657)

- `collectionInfo`: copies = número de Moments; cards = usos de cada Moment; hold = cartas em cada conta.
- `optimizeMulti`: aplica a regra 5 (`tierOk`), contando também as jogadas já feitas.
- `transfersFor`: diz que carta mandar, e quando ("Manda o Rare do X para a conta Y").
- **Usos de cada smurf (desde 21 out, à noite):** cada smurf tem os usos da melhor carta da coleção, mesmo que essa carta esteja noutra conta, menos os que já gastou. Isto é `colTopUses − usedCount`.
  - Um valor gravado mais baixo (por exemplo, a (smurf) a mostrar 1 Luka em vez de 2) já não passa por cima disto.
  - Só vale um número mais baixo se for mudado à mão (`e.sm[conta]`). Nesse caso a ficha do jogador mostra "Pela coleção: N · repor".
