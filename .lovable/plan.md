
# Plano: Corrigir AI Mode Após Atribuição pelo Dispatcher

## Problema Identificado

O distribuidor automático (dispatcher) atribui conversas a agentes mas **não muda** o `ai_mode` de `waiting_human` para `copilot`. Resultado:

| Campo | Valor |
|-------|-------|
| `assigned_to` | Juliana Alves ✅ |
| `ai_mode` | waiting_human ❌ (deveria ser `copilot`) |

A UI verifica:
```typescript
const canShowTakeControl = isAutopilot || isWaitingHuman || !conversation?.assigned_to;
```

Como `isWaitingHuman = true`, ela mostra "Clique em Assumir" mesmo para a própria Juliana que já foi atribuída!

---

## Causa Raiz

No arquivo `dispatch-conversations/index.ts` (linhas 251-259):

```typescript
.update({
  assigned_to: eligibleAgent.id,
  // ai_mode: Não muda - mantém 'waiting_human', agente decide via UI
  dispatch_status: 'assigned',
  ...
})
```

O comentário diz que o agente deveria decidir via UI, mas a UI não permite isso porque ainda mostra a tela de "Assumir".

---

## Solução: Dispatcher Deve Mudar ai_mode para copilot

Quando o dispatcher atribui uma conversa a um agente, ele deve:
1. Definir `assigned_to = agente.id`
2. **Mudar** `ai_mode = 'copilot'` (não mais `waiting_human`)

### Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/dispatch-conversations/index.ts` | Adicionar `ai_mode: 'copilot'` no update de atribuição |

### Código Atual (linha 252-259)
```typescript
const { data: updateResult, error: updateError } = await supabase
  .from('conversations')
  .update({
    assigned_to: eligibleAgent.id,
    // ai_mode: Não muda - mantém 'waiting_human', agente decide via UI
    dispatch_status: 'assigned',
    last_dispatch_at: new Date().toISOString(),
  })
```

### Código Novo
```typescript
const { data: updateResult, error: updateError } = await supabase
  .from('conversations')
  .update({
    assigned_to: eligibleAgent.id,
    ai_mode: 'copilot', // ✅ FIX: Mudar para copilot na atribuição
    dispatch_status: 'assigned',
    last_dispatch_at: new Date().toISOString(),
  })
```

---

## Impacto

### Antes (Bug)

| Cenário | Resultado |
|---------|-----------|
| Dispatcher atribui Juliana | `ai_mode = waiting_human` → UI mostra "Assumir" ❌ |
| Juliana abre a conversa | Não consegue digitar, precisa clicar em "Assumir" ❌ |
| Juliana clica em "Assumir" | Finalmente pode escrever ✅ |

### Depois (Corrigido)

| Cenário | Resultado |
|---------|-----------|
| Dispatcher atribui Juliana | `ai_mode = copilot` ✅ |
| Juliana abre a conversa | Composer já está habilitado ✅ |
| Juliana pode responder imediatamente | Sem cliques extras ✅ |

---

## Compatibilidade

- ✅ Mantém consistência: atribuição = copilot
- ✅ Alinhado com `useTakeControl` que já define `copilot` na atribuição manual
- ✅ UI funciona corretamente porque `copilot` habilita o composer
- ✅ Logs de auditoria mantidos
- ✅ Não afeta conversas em `autopilot` (IA respondendo)

---

## Fix Adicional (Opcional): Dados Existentes

Para corrigir conversas já atribuídas mas travadas em `waiting_human`, pode-se executar um fix pontual no SQL:

```sql
-- Fix: Conversas atribuídas mas ainda em waiting_human
UPDATE conversations
SET ai_mode = 'copilot'
WHERE assigned_to IS NOT NULL
  AND ai_mode = 'waiting_human'
  AND status = 'open';
```

---

## Seção Técnica

### Fluxo Corrigido

```text
Cliente pede atendente
        ↓
process-chat-flow → ai_mode = 'waiting_human'
        ↓
conversation_dispatch_jobs (job criado)
        ↓
dispatch-conversations (CRON)
        ↓
Encontra agente → assigned_to = Juliana
                → ai_mode = 'copilot' (FIX)
        ↓
Juliana abre inbox → Composer habilitado ✅
```
