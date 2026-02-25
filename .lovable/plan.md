

# Diagnóstico: IA Transferindo em Vez de Ajudar

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Problema Real Identificado

A IA **não está "alucinando"** — ela está **sem cota/saldo** para processar qualquer requisição. Os logs mostram claramente:

```text
QUOTA_ERROR: Erro de Saldo/Cota na IA.
```

**Fluxo do que aconteceu:**

1. Cliente mandou "Eu quero falar sobre um pedido"
2. O fluxo de chat (`process-chat-flow`) falhou com `unique_active_flow` constraint (estado preso no banco)
3. O sistema caiu para o `ai-autopilot-chat` como fallback
4. O Autopilot tentou chamar a OpenAI → **falhou** (429 / quota)
5. O Autopilot tentou o fallback Lovable AI → **também falhou** (429 / quota)
6. O sistema enviou a mensagem de erro: *"Desculpe, estou com dificuldades técnicas. Vou te conectar com um atendente humano!"*

**Ou seja: a IA nem chegou a processar a mensagem. Ela foi bloqueada por falta de saldo.**

## Dois Problemas a Resolver

### Problema 1: Estado travado no banco (unique_active_flow)

O `process-chat-flow` tenta limpar estados antigos, mas filtra apenas pelo `flow_id` do rascunho. Porém existe um estado **ativo do fluxo principal** (`3ea0d227`) que interfere. A limpeza precisa ser mais abrangente.

**Fix:** Antes de iniciar um fluxo manual (teste de rascunho), limpar TODOS os estados ativos da conversa, independente do `flow_id`.

### Problema 2: Quota da IA esgotada

Tanto a OpenAI quanto o gateway Lovable AI estão retornando 429. A mensagem "dificuldades técnicas" é o fallback de erro, não uma decisão da IA.

**Fix:** Verificar/renovar o saldo da chave OpenAI. Adicionalmente, melhorar a mensagem de fallback para não parecer transferência, e sim aviso temporário.

## Alterações Propostas

| Arquivo | Mudança |
|---|---|
| `supabase/functions/process-chat-flow/index.ts` | Na limpeza de estados antes do insert manual, remover filtro `.eq('flow_id', flow.id)` — limpar TODOS os estados ativos/waiting_input da conversa |
| `supabase/functions/ai-autopilot-chat/index.ts` | Melhorar mensagem de fallback de quota para diferenciar "sem saldo" de "erro técnico" — evitar transferência automática quando é só quota |
| SQL (migration) | Limpar o estado travado atual: `DELETE FROM chat_flow_states WHERE conversation_id = '4ed80263-02fc-4085-9b29-5290a4174dc5' AND status = 'active'` |

## Detalhamento Técnico

### Fix 1: Limpeza abrangente em process-chat-flow (linha ~668)

```typescript
// ANTES (limpa só o flow específico):
.eq('conversation_id', conversationId)
.eq('flow_id', flow.id)
.in('status', ['active', 'waiting_input', 'in_progress']);

// DEPOIS (limpa TODOS os flows ativos da conversa):
.eq('conversation_id', conversationId)
.in('status', ['active', 'waiting_input', 'in_progress']);
```

### Fix 2: Fallback de quota no ai-autopilot-chat

Quando o erro é `QUOTA_ERROR`, em vez de enviar "dificuldades técnicas + transferir", enviar uma mensagem mais adequada como "Estou com alta demanda no momento, por favor tente novamente em alguns instantes" e **não** fazer transferência automática. Isso evita o comportamento de "a IA transferiu sem tentar".

### Ação Imediata do Usuário

Verificar o saldo/cota da chave `OPENAI_API_KEY` configurada. Se a cota estiver zerada, é preciso recarregar no painel da OpenAI para que a IA volte a funcionar normalmente.

## Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — apenas melhora limpeza e fallback |
| Kill Switch | Preservado |
| Rollback | Reverter delete filter e mensagem de fallback |

