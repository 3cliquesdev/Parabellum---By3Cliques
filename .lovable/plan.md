

# Fix: IA deve encerrar proativamente após resolver o atendimento

## Problema

O prompt atual instrui a IA a encerrar "SOMENTE quando o cliente indicar CLARAMENTE que não tem mais dúvidas". Isso é muito passivo — a IA resolve o problema do cliente (ex: informações sobre entrega na conversa #1096B783) mas nunca oferece encerrar. A conversa fica aberta até o auto-close aplicar "Falta de Interação".

## Solução

Atualizar o prompt da tool `close_conversation` para incluir comportamento **proativo**: após resolver completamente a demanda do cliente, a IA deve perguntar se pode ajudar em algo mais (usando `close_conversation` com `customer_confirmed=false`).

### Alteração no prompt (linha ~7705)

**De:**
```
Encerre SOMENTE quando o cliente indicar CLARAMENTE que não tem mais dúvidas
```

**Para:**
```
Use em 2 situações:
1. PROATIVO: Quando você resolveu completamente a demanda do cliente (respondeu a dúvida, 
   forneceu informações, concluiu operação), chame com customer_confirmed=false para 
   perguntar "Posso ajudar em algo mais?". Exemplos: informou status de entrega, 
   esclareceu dúvida, confirmou dados.
2. REATIVO: Quando o cliente indicar que não tem mais dúvidas ("era só isso", 
   "não tenho mais dúvidas", "pode encerrar").

NÃO interprete agradecimentos ("obrigado", "valeu") como sinal de encerramento.
SEMPRE pergunte antes (customer_confirmed=false). 
IMPORTANTE: SEMPRE chame tag_conversation ANTES de close_conversation.
```

Isso mantém o 2-step confirmation (segurança) mas permite que a IA tome a iniciativa de perguntar ao cliente após resolver o atendimento.

### Arquivo

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/ai-autopilot-chat/index.ts` | Prompt da tool close_conversation mais proativo (linha ~7705) |

Deploy: `ai-autopilot-chat`

