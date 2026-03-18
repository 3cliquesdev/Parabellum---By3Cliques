

# Liberar visibilidade da Fila IA para TODOS os atendentes (incluindo consultant)

## Problema
No `src/hooks/useInboxView.tsx`, o role `consultant` está agrupado com `user` (linhas 228 e 283), recebendo filtro restritivo `assigned_to.eq.${userId}`. Isso impede que consultores vejam a fila IA global.

## Solução
Adicionar `consultant` na condição dos roles operacionais que já têm visibilidade da fila IA.

### Arquivo: `src/hooks/useInboxView.tsx`

**4 pontos de mudança:**

1. **Linha 218** — chunked path, adicionar `consultant`:
```ts
if (role === "sales_rep" || role === "support_agent" || role === "financial_agent" || role === "consultant") {
```

2. **Linha 228** — chunked path, remover `consultant` do bloco restritivo:
```ts
} else if (role === "user") {
```

3. **Linha 273** — main path, adicionar `consultant`:
```ts
if (role === "sales_rep" || role === "support_agent" || role === "financial_agent" || role === "consultant") {
```

4. **Linha 283** — main path, remover `consultant` do bloco restritivo:
```ts
} else if (role === "user") {
```

### Resultado
- Todos os atendentes (support_agent, sales_rep, financial_agent, **consultant**) veem a fila IA global
- Role `user` (cliente) continua restrito às próprias conversas
- Sem mudança de RLS — a policy `optimized_inbox_select` já libera consultant

