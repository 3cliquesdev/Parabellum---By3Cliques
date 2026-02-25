

# Plano: Corrigir Busca de Tickets para Mostrar Todos os Status

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Problema Identificado

A busca de tickets não encontra tickets com status `resolved` ou `closed` porque:

1. **`useSearchTickets` (modal de mesclagem):** Filtra apenas `open`, `in_progress`, `waiting_customer` na linha 29 — exclui 636 dos 714 tickets (89%).

2. **`useTickets` (tela principal /support):** O filtro padrão da sidebar `all` aplica apenas status ativos (não-arquivados: `open`, `in_progress`, `waiting_customer`). A busca é **client-side** sobre esse conjunto já filtrado — portanto tickets resolvidos/fechados nunca aparecem na busca, mesmo digitando o número exato.

```text
Dados atuais:
  resolved:         551 tickets (77%)
  closed:            85 tickets (12%)
  open:              51 tickets  (7%)
  returned:          23 tickets  (3%)
  waiting_customer:   4 tickets  (1%)

→ Busca atual só "vê" ~8% dos tickets
```

## Solução

### Upgrade 1: Busca global na tela de tickets (`useTickets`)

Quando o usuário digita um termo de busca (`advancedFilters.search` não vazio), **remover o filtro de status** para que a busca percorra TODOS os tickets, independentemente do status. Isso é feito na lógica `getHookParams()` do `Support.tsx`:

- Se `search` está preenchido e nenhum status foi selecionado manualmente → não aplicar filtro de status (busca global)
- Se o usuário selecionou status específicos no filtro avançado → respeitar a seleção

### Upgrade 2: Busca expandida no `useSearchTickets` (mesclagem)

Remover o filtro `.in("status", [...])` da linha 29 para que a busca de mesclagem encontre tickets em qualquer status ativo (exceto já mesclados).

## Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/Support.tsx` | Em `getHookParams()`, quando há search ativo e status não foi explicitamente filtrado, não aplicar filtro de status |
| `src/hooks/useSearchTickets.tsx` | Remover `.in("status", [...])` restritivo |

## Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — busca retorna mais resultados, não menos |
| Performance | Sem impacto significativo — busca client-side já processa todos os dados retornados |
| Rollback | Restaurar filtro de status nas duas linhas |

