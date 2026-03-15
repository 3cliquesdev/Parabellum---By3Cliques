

# Plano: Corrigir nó de Triagem + Deploy das Edge Functions

## Estado atual do nó `node_4_ia_triagem`

| Campo | Valor atual | Valor desejado |
|---|---|---|
| `forbid_questions` | `false` | `false` ✅ já correto |
| `forbid_options` | **`true`** | `false` ❌ precisa alterar |
| `fallback_message` | "Entendido! Deixa eu te encaminhar para o especialista certo." | "Pode me contar mais sobre o que precisa?" |

## Passos

### 1. Atualizar dados do nó no banco
Executar UPDATE no `flow_definition` JSONB para alterar `forbid_options → false` e `fallback_message` no nó `node_4_ia_triagem`.

### 2. Deploy das 3 Edge Functions
Disparar deploy imediato de:
- `handle-whatsapp-event`
- `ai-autopilot-chat`
- `process-chat-flow`

Nenhuma alteração de código — apenas update de dados e deploy.

