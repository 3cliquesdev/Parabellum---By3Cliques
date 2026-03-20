

## Correção: Auto-close respeitar tag do nó do fluxo

### Problema
Quando o auto-close encerra uma conversa por inatividade (Stage 3, 3b, 3.5), sempre aplica a tag hardcoded "9.98 Falta de Interação". A tag correta deveria vir da configuração do nó de IA onde a conversa estava ativa (ex: "6.05 Saque do saldo" para o nó financeiro).

### Solução em 3 partes

**Parte 1 — UI: Adicionar campo `close_tag_id` no nó `ai_response`**

Arquivos:
- `src/components/chat-flows/nodes/AIResponseNode.tsx` — Adicionar `close_tag_id` na interface de dados e exibir badge da tag no nó
- `src/components/chat-flows/AIResponsePropertiesPanel.tsx` — Adicionar select de tag na seção de configuração (reutilizar lista de tags existente)

O campo permite ao usuário configurar qual tag aplicar quando a conversa for encerrada enquanto estiver neste nó de IA.

**Parte 2 — Flow Engine: Propagar `close_tag_id` via `flow_context`**

Arquivo: `supabase/functions/process-chat-flow/index.ts`

Em todos os pontos onde `ticketConfig` já é propagado no response JSON (~6 locais), adicionar:
```typescript
closeTagId: resolvedNode.data?.close_tag_id || null,
```

Seguindo o mesmo padrão de `ticketConfig`, `forbidSupport`, etc.

**Parte 3 — Auto-close: Usar tag do fluxo em vez do hardcoded**

Arquivo: `supabase/functions/auto-close-conversations/index.ts`

Em cada stage que aplica tag (Stage 3, 3b, 3.5), antes de aplicar `FALTA_INTERACAO_TAG_ID`:

1. Buscar `chat_flow_states` ativo da conversa (já existe query similar no Stage 3b, L620-626)
2. Se encontrar, buscar o nó atual no `flow_definition` e ler `close_tag_id`
3. Se `close_tag_id` existir, usar essa tag; senão, fallback para `dept.ai_auto_close_tag_id` ou `FALTA_INTERACAO_TAG_ID`

```typescript
// Helper reutilizável
async function getFlowCloseTagId(supabase, conversationId) {
  const { data: flowState } = await supabase
    .from('chat_flow_states')
    .select('current_node_id, flow_id')
    .eq('conversation_id', conversationId)
    .in('status', ['active', 'waiting_input', 'in_progress'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (!flowState) return null;
  
  const { data: flow } = await supabase
    .from('chat_flows')
    .select('flow_definition')
    .eq('id', flowState.flow_id)
    .single();
  
  const node = flow?.flow_definition?.nodes?.find(
    n => n.id === flowState.current_node_id
  );
  return node?.data?.close_tag_id || null;
}
```

Aplicar nos 3 stages:
- **Stage 3** (L363-372): `const tagId = flowCloseTagId || dept.ai_auto_close_tag_id || FALTA_INTERACAO_TAG_ID`
- **Stage 3b** (L667-671): `const tagId = flowCloseTagId || FALTA_INTERACAO_TAG_ID`
- **Stage 3.5** (L764-768): `const tagId = flowCloseTagId || FALTA_INTERACAO_TAG_ID`

### Deploy
- `process-chat-flow`
- `auto-close-conversations`

### Resultado
- Conversa de saque encerrada por inatividade recebe tag "6.05 Saque do saldo" (configurada no nó)
- Conversas sem tag configurada no nó mantêm o comportamento atual (tag do departamento ou "Falta de Interação")
- Configurável por nó no editor visual de fluxos

