
# ✅ CONCLUÍDO — Template Soberano + Tags no Ticket Config

## Hierarquia corrigida (6 pontos)

Em todos os 6 locais do `ai-autopilot-chat/index.ts`:

1. **`description_template`** → Envia verbatim (tudo de uma vez). Template do admin é soberano.
2. **`objective` + `smartCollectionFields`** → LLM segue objective (campo a campo).
3. **Nenhum** → Fallback genérico.

## Tags no Ticket

- **Frontend**: Multi-select de tags adicionado em `AIResponsePropertiesPanel.tsx` na seção de ticket config.
- **Backend**: `tag_ids` propagado para `generate-ticket-from-conversation` e inserido em `ticket_tags` após criação do ticket via `create_ticket` tool.

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/ai-autopilot-chat/index.ts` | 6 pontos: `description_template` > `objective` > fallback; + `tag_ids` na criação de ticket |
| `src/components/chat-flows/AIResponsePropertiesPanel.tsx` | Multi-select de Tags no ticket config |

## Deploy
- ✅ `ai-autopilot-chat` deployed
