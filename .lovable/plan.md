

# Fix: Auto-close para conversas sem departamento

## Problema

A query da Etapa 3 (`auto-close-conversations`) filtra por `department = dept.id`, ignorando conversas com `department IS NULL`. Das 20 conversas abertas com +5 min de inatividade, 18 não têm departamento atribuído.

## Solução

Adicionar uma **Etapa 3b** na edge function `auto-close-conversations` que processa conversas em autopilot **sem departamento** usando um fallback global de 5 minutos.

### Arquivo: `supabase/functions/auto-close-conversations/index.ts`

**Após a Etapa 3 (~linha 418), adicionar Etapa 3b:**

1. Buscar conversas `status='open'`, `ai_mode='autopilot'`, `department IS NULL`, `last_message_at < NOW() - 5 min`
2. Para cada conversa:
   - Verificar que última mensagem **não** é do contact (mesmo guard da Etapa 3)
   - Inserir mensagem de encerramento por inatividade
   - Aplicar tag "Desistência"
   - Fechar com `closed_reason: 'ai_inactivity'`, `auto_closed: true`
   - **Não** enviar CSAT (sem departamento = sem config de rating)
3. Usar o mesmo `AI_CLOSE_MESSAGE` já existente
4. Adicionar ao `closedIds` para não duplicar

### Detalhes técnicos

```sql
-- Query a adicionar
SELECT id, contact_id, last_message_at, ai_mode, channel, 
       whatsapp_instance_id, whatsapp_meta_instance_id, whatsapp_provider
FROM conversations
WHERE status = 'open'
  AND ai_mode = 'autopilot'
  AND department IS NULL
  AND last_message_at < (NOW() - INTERVAL '5 minutes')
```

- Fallback fixo de 5 minutos (padrão seguro)
- Sem CSAT (não há departamento para consultar `send_rating_on_close`)
- Mesma mensagem de cortesia e tag "Desistência"
- Log claro: `[Auto-Close] ✅ No-dept AI closed conversation {id} - ai_inactivity (no department)`

### Impacto
- Zero regressão: Etapas 1, 2 e 3 inalteradas
- Aditiva: nova etapa 3b só pega o que as outras não pegam
- Resolve as 18+ conversas órfãs imediatamente no próximo ciclo (10 min)

