
# Plano: Mensagens Configuráveis de Fora do Horário ✅

## Status: IMPLEMENTADO

## Resumo

As mensagens automáticas enviadas fora do horário comercial (handoff e redistribuição) agora são editáveis via UI na página de SLA Settings. Templates armazenados na tabela `business_messages_config` com fallback para mensagens padrão.

## Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| SQL Migration | Tabela `business_messages_config` + seeds + RLS |
| `src/hooks/useBusinessMessages.ts` | Novo hook (query + mutation) |
| `src/pages/SLASettings.tsx` | Seção "Mensagens de Fora do Horário" na aba Horário Comercial |
| `supabase/functions/ai-autopilot-chat/index.ts` | Busca template `after_hours_handoff` com placeholders `{schedule}`, `{next_open}` |
| `supabase/functions/redistribute-after-hours/index.ts` | Busca template `business_hours_reopened` |

## Garantias

- Fallback hardcoded se tabela vazia ou inacessível
- Kill Switch, Shadow Mode, Fluxos: não afetados
- RLS: leitura authenticated, escrita managers/admins
