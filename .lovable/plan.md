

# Relatório com data em vez de "HOJE"/"ONTEM"

## Mudanças

### 1. Cron: `0 21 * * *` → `0 4 * * *` (01:00 BRT)
Executar SQL no cron para atualizar o schedule.

### 2. Labels no `supabase/functions/ai-governor/index.ts`

`dateStr` já existe (linha 1249) com a data formatada. Substituir todas as ocorrências de `HOJE` por `dateStr`:

| Linha | Atual | Novo |
|-------|-------|------|
| 1266 | `📞 *HOJE — Atendimento*` | `📞 *${dateStr} — Atendimento*` |
| 1273 | `CSAT hoje:` | `CSAT:` |
| 1282 | `💰 *HOJE — Vendas Novas*` | `💰 *${dateStr} — Vendas Novas*` |
| 1291 | `🔄 *HOJE — Recorrências*` | `🔄 *${dateStr} — Recorrências*` |
| 1298-1299 | `📥 *HOJE — Pipeline*` (2x) | `📥 *${dateStr} — Pipeline*` |
| 1303 | `🏷️ *HOJE — Tags*` | `🏷️ *${dateStr} — Tags*` |
| 1312 | `🎫 *HOJE — Tickets*` | `🎫 *${dateStr} — Tickets*` |
| 1331 | `Canais de Venda (Hoje)` | `Canais de Venda (${dateStr})` |

Header (1335) já usa `dateStr` — manter como está.

Nenhuma lógica de datas muda — apenas labels visuais.

