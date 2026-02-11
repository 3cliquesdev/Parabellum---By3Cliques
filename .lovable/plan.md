

# Fix: Capacidade de distribuição inconsistente

## Problema Raiz

Existem **dois fallbacks diferentes** no mesmo arquivo `dispatch-conversations/index.ts`:

- **Linha 550**: Quando o agente ESTA em `team_members` mas `max_concurrent_chats` e NULL → fallback = **40** (correto)
- **Linha 576**: Quando o agente NAO esta em `team_members` (nao entra no capacityMap) → fallback = **10** (errado!)

A Mabile nao esta cadastrada em nenhum team, entao o sistema aplica o limite de 10. Com 15 chats ativos, ela aparece como "at capacity" mesmo tendo capacidade para 40.

## Correcao

### Arquivo: `supabase/functions/dispatch-conversations/index.ts`

Mudar a **linha 576** de:

```typescript
max_chats: capacityMap.get(p.id) ?? 10,
```

Para:

```typescript
max_chats: capacityMap.get(p.id) ?? 40,
```

Isso garante que agentes que nao pertencem a nenhum team tambem usem o padrao de 40 conversas simultaneas, consistente com a linha 550.

### Impacto

- **Mabile**: Vai passar de limite 10 para 40. Com 15 chats ativos, volta a ter capacidade (15 < 40)
- **Outros agentes sem team**: Tambem serao beneficiados pelo limite correto
- **Agentes COM team**: Zero impacto (ja usam o valor do `team_settings` ou fallback 40 da linha 550)
- **Zero regressao**: Apenas corrige inconsistencia de fallback

### Apos o deploy

Os 57 jobs `escalated` serao reprocessados automaticamente na proxima execucao do dispatcher (ou quando um agente voltar online, conforme a politica de requeue existente).
