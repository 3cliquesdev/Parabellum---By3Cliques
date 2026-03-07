
# Plano: Fallback Inteligente Fora do Horário (sem "falso SLA") ✅

## Status: IMPLEMENTADO

## Resumo

Lógica invertida: `redistribute-after-hours` agora age **dentro do horário** (redistribui conversas com tag `pendente_retorno`). Fora do horário, a IA mantém `autopilot` e registra pendência sem chamar `route-conversation`.

## Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/redistribute-after-hours/index.ts` | Reescrita: age dentro do horário, busca tag `pendente_retorno`, roteia e remove tag |
| `supabase/functions/ai-autopilot-chat/index.ts` | Import business-hours + contexto no prompt + condicional no `request_human_agent` |
| SQL Migration | Tag `pendente_retorno` criada na tabela `tags` |

## Lógica Implementada

### redistribute-after-hours (cron)
- `within_hours = false` → nada a fazer
- `within_hours = true` → busca conversas com tag `pendente_retorno` → route-conversation → waiting_human → remove tag → mensagem sistema

### ai-autopilot-chat
- **Prompt:** Injeta info de horário comercial (aberto/fechado + próxima abertura)
- **request_human_agent dentro do horário:** comportamento padrão (copilot + route-conversation)
- **request_human_agent fora do horário:**
  - NÃO chama route-conversation
  - NÃO muda ai_mode (mantém autopilot)
  - Envia mensagem informativa ao cliente
  - Aplica tag `pendente_retorno`
  - Salva metadata (after_hours_handoff_requested_at, pending_department_id, etc.)
  - Registra nota interna

## Garantias

- Kill Switch: respeitado (verificado antes)
- Shadow Mode: não afetado
- Fluxos: soberania mantida (guard `if (!flow_context)`)
- SLA: zero handoff fantasma fora do horário
- Cron existente: mantém `* * * * *` do config.toml
