
# Plano: Mensagens Configuráveis de Fora do Horário ✅

## Status: IMPLEMENTADO (com ajustes finos aplicados)

## Resumo

As mensagens automáticas enviadas fora do horário comercial (handoff e redistribuição) agora são editáveis via UI na página de SLA Settings. Templates armazenados na tabela `business_messages_config` com fallback para mensagens padrão.

## Ajustes Finos Aplicados

- ✅ Trigger `updated_at` reutilizando `public.update_updated_at_column()`
- ✅ Validação: botão salvar desabilitado se template vazio
- ✅ Warning visual se placeholders `{schedule}` / `{next_open}` removidos
- ✅ Botão "Restaurar Padrão" para resetar mensagens

## Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| SQL Migrations | Tabela `business_messages_config` + seeds + RLS + trigger updated_at |
| `src/hooks/useBusinessMessages.ts` | Hook (query + mutation) |
| `src/pages/SLASettings.tsx` | Seção "Mensagens de Fora do Horário" com validação + restaurar padrão |
| `supabase/functions/ai-autopilot-chat/index.ts` | Busca template `after_hours_handoff` com fallback |
| `supabase/functions/redistribute-after-hours/index.ts` | Busca template `business_hours_reopened` com fallback |

## Garantias

- Fallback hardcoded se tabela vazia ou inacessível
- Kill Switch, Shadow Mode, Fluxos: não afetados
- RLS: leitura authenticated, escrita managers/admins
