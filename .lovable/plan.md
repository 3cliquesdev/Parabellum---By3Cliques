

# Auditoria: Falhas de Envio e Encerramento de Conversas

## Resumo Executivo

Nas últimas 3 horas, **46 mensagens falharam** com o erro `"Failed to send a request to the Edge Function"`, afetando **21 conversas** e **5 agentes**. A causa raiz é **instabilidade transiente nas Edge Functions** (mesma origem dos erros 503 no `get-inbox-counts`).

---

## Conversas Auditadas

| ID | Status | Problema |
|----|--------|----------|
| `A4DB73F2` | closed | 3 mensagens falharam (agente Loriani tentou enviar 3x a mesma despedida). Conversa encerrada manualmente após falhas. |
| `9E5D598E` | open | 1 mensagem falhou ("Nossa integração é direta"). Conversa continua ativa. |
| `8446E6E5` | open | `ai_mode: waiting_human`, sem mensagens falhadas neste período. Problema é falta de agente ativo. |
| `7909F5CB` | open | `ai_mode: waiting_human`, sem mensagens falhadas neste período. Problema é falta de agente ativo. |

## Agentes Mais Afetados

| Agente | Falhas |
|--------|--------|
| Juliana Alves | 14 (enviou rápido em sequência ~13:50) |
| Fernanda | 5 |
| Miguel Fedes | 4 |
| Loriani Vitoria | 3 |
| Mabile Silva | 3 |

## Causa Raiz

O erro `"Failed to send a request to the Edge Function"` é um erro **client-side do SDK Supabase** que ocorre quando a Edge Function não responde (timeout/503). Não é um bug no código — é instabilidade de infraestrutura temporária.

Evidências:
- `send-meta-whatsapp` tem logs de sucesso no mesmo período (13:55-13:56)
- `get-inbox-counts` teve erros 503 no mesmo intervalo
- Pico de falhas concentrado em 1 minuto (13:50 — 9 falhas) sugere sobrecarga momentânea

## Plano de Correção

### 1. Adicionar retry automático no `useSendMessageInstant.tsx`
Quando `send-meta-whatsapp` falha com erro de rede, tentar novamente 1x após 2 segundos antes de marcar como `failed`.

**Arquivo:** `src/hooks/useSendMessageInstant.tsx`
- Envolver a chamada `supabase.functions.invoke('send-meta-whatsapp')` em helper com 1 retry
- Mesmo tratamento para `supabase.functions.invoke('send-whatsapp-message')`

### 2. Adicionar botão "Reenviar" em mensagens falhadas
Permitir que o agente clique para reenviar uma mensagem que ficou com `status: failed`.

**Arquivo:** `src/components/ChatWindow.tsx` ou componente de mensagem
- Exibir botão "Reenviar" em mensagens com `status === 'failed'`
- Ao clicar, invocar a edge function novamente com o mesmo conteúdo

### 3. Corrigir mensagens já falhadas (one-time fix)
Criar query para identificar mensagens `failed` que o agente reenviou manualmente (conteúdo duplicado com status `read`), e limpar as duplicatas falhadas.

---

## Sobre Encerramento de Conversas

As conversas `8446E6E5` e `7909F5CB` não tiveram erro de encerramento — estão em `waiting_human` sem agente ativo. O problema reportado pelos atendentes sobre "não conseguir encerrar" pode estar relacionado à mesma instabilidade: o `close-conversation` edge function também ficou inacessível durante o pico de 503s.

