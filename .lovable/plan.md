

# Por que a Mabile mandou mensagem mas a conversa voltou para fila da IA

## Diagnóstico

O problema é claro: **`sendInstant` não atualiza `assigned_to` nem `ai_mode`**.

Quando a Mabile enviou mensagens manualmente na conversa #DD4C1A25:

1. Ela **não clicou "Assumir"** (Take Control) — apenas digitou e enviou no composer
2. O `sendInstant` salvou a mensagem no banco, mas só atualizou `last_message_at` (linha 311-317)
3. Os campos `assigned_to` e `ai_mode` permaneceram: `null` e `waiting_human`
4. Quando o contato respondeu, o webhook viu `ai_mode: waiting_human` + `assigned_to: null` → disparou mensagem de fila

**Resumo**: O sistema não reconhece mensagens enviadas via composer como "tomada de controle". Só o botão "Assumir" (que chama `useTakeControl` → RPC `take_control_secure`) faz essa atualização.

## Solução proposta

### Auto-assign ao enviar mensagem

No `sendInstant`, após persistir a mensagem no banco (linha ~310), adicionar lógica para **auto-atribuir** a conversa ao agente se:
- A mensagem NÃO é interna (`!isInternal`)
- A conversa não tem `assigned_to` ou o `ai_mode` é `autopilot`/`waiting_human`

Alterações:

1. **`src/hooks/useSendMessageInstant.tsx`** — Após o update de `last_message_at` (linha 310-318), adicionar update condicional:
   - Buscar estado atual da conversa (`assigned_to`, `ai_mode`)
   - Se `assigned_to` é null e `ai_mode` não é `disabled`, atualizar: `assigned_to = user.id`, `ai_mode = 'copilot'`
   - Terminar qualquer `chat_flow_state` ativo para essa conversa

2. **Alternativa mais segura (RPC)**: Criar uma RPC `auto_assign_on_send` que faça a mesma validação que `take_control_secure` mas de forma mais leve, sem gerar interação/nota, apenas atribuindo o agente.

### Arquivo alterado
- `src/hooks/useSendMessageInstant.tsx` — adicionar auto-assign após persistência

### Impacto
- Agentes que enviam mensagem sem clicar "Assumir" serão automaticamente atribuídos
- Evita que a IA/dispatch interfira em conversas onde um humano já está respondendo

