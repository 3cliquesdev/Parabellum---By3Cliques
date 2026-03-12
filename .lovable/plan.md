

# Fix: Auto-close quando cliente não responde à confirmação de encerramento

## Problema

Quando a IA pergunta "Posso ajudar em algo mais?" e seta `awaiting_close_confirmation=true` no metadata, se o cliente **não responde**, a conversa fica aberta indefinidamente. O `auto-close-conversations` já roda periodicamente mas não detecta esse cenário específico.

## Solução

Adicionar uma **Etapa 3.5** no `auto-close-conversations/index.ts` que busca conversas com `awaiting_close_confirmation=true` no `customer_metadata` e que estejam inativas há X minutos (usar 5 min como padrão). Se o cliente não respondeu, fechar automaticamente como se tivesse confirmado "sim".

### Mudança: `supabase/functions/auto-close-conversations/index.ts`

Inserir nova etapa entre Stage 3b e Stage 4 (~linha 618):

```text
ETAPA 3.5: Auto-close awaiting_close_confirmation sem resposta
```

Lógica:
1. Buscar conversas `status=open` onde `customer_metadata->awaiting_close_confirmation = true`
2. Filtrar por `last_message_at < 5 minutos atrás`
3. Verificar que a última mensagem é do bot/IA (não do cliente) — confirma que o cliente não respondeu
4. Para cada conversa encontrada:
   - Limpar flag `awaiting_close_confirmation` do metadata
   - Enviar mensagem de encerramento: "Como não recebi resposta, estou encerrando o atendimento. Se precisar, é só nos chamar novamente!"
   - Aplicar tag "Falta de Interação"
   - Invocar `close-conversation` (reutiliza CSAT, métricas, timeline)
   - Enviar via WhatsApp se necessário

Timeout de 5 minutos é consistente com o fallback do Stage 3b (conversas sem departamento).

### Resultado

```text
IA: "Posso ajudar em algo mais?"
  → Cliente responde "sim/não" → fluxo existente (funciona)
  → Cliente NÃO responde (5 min) → auto-close-conversations fecha automaticamente ✅
```

## Arquivo a editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/auto-close-conversations/index.ts` | Nova Etapa 3.5 — auto-close por `awaiting_close_confirmation` sem resposta |

