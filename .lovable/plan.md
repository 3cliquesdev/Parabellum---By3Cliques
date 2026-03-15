

# Plano: Atualizar 3 Edge Functions (upgrade incremental)

## Arquivos a substituir

1. **`supabase/functions/process-chat-flow/index.ts`** → conteúdo de `process-chat-flow-index_4.ts` (5656 linhas)
2. **`supabase/functions/ai-autopilot-chat/index.ts`** → conteúdo de `ai-autopilot-chat_6.ts` (9790 linhas)
3. **`supabase/functions/handle-whatsapp-event/index.ts`** → conteúdo de `handle-whatsapp-event_2.ts` (2174 linhas)

## Impacto
- Deploy automático das 3 functions
- Nenhuma alteração de banco ou frontend
- Mudanças incrementais pequenas (+21, +5, ~0 linhas)

