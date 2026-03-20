

# Corrigir Template de Coleta + Adicionar Tags ao Ticket Config

## Problema 1: Template do IA Response sendo ignorado

A correção anterior fez o `objective` ter prioridade **absoluta** sobre o `description_template`. Porém, o `description_template` é o template configurado pelo administrador no painel do IA Response — ele É o fluxo soberano. A regra correta é:

- **Se tem `description_template`** → Enviar o template verbatim (tudo de uma vez). É a configuração explícita do administrador.
- **Se NÃO tem `description_template` mas tem `smartCollectionFields` + `objective`** → Aí sim, seguir o objective (campo a campo).
- **Se NÃO tem nenhum** → Fallback genérico.

### Pontos a corrigir no `ai-autopilot-chat/index.ts`

Nos 6 locais onde `nodeObjective` sobrescreve a lógica, adicionar check: se `flow_context?.ticketConfig?.description_template` existe, ele tem prioridade máxima (envia verbatim). O `objective` só governa quando a coleta é via `smartCollectionFields` sem template.

| Local | Linha ~aprox | Mudança |
|-------|-------------|---------|
| `identityWallNote` pós-OTP | ~6922 | `description_template` → enviar verbatim; `smartCollectionFields` + objective → campo a campo |
| `directOTPSuccessResponse` | ~6520 | Idem |
| `otpVerifiedInstruction` system prompt | ~7073 | Idem |
| Fallback LLM vazio | ~8006 | Idem |
| OTP handler inline | ~8684 | Idem |
| Fallback blocker | ~9871 | Idem |

## Problema 2: Adicionar campo `tag_ids` ao Ticket Config

O `generate-ticket-from-conversation` já suporta `tag_ids`. Falta:

### Frontend — `AIResponsePropertiesPanel.tsx`
Adicionar multi-select de Tags dentro da seção `ticketConfig.enabled`, usando o hook `useTags` (já importado). O campo salva `tag_ids: string[]` no `ticket_config`.

### Backend — `ai-autopilot-chat/index.ts`
1. Adicionar `tag_ids` à interface `FlowContext.ticketConfig`
2. Na criação de ticket (L8902-8917), após o `insert`, se `tc?.tag_ids?.length > 0`, inserir em `ticket_tags`
3. Na chamada a `generate-ticket-from-conversation` (L6271), passar `tag_ids: tc?.tag_ids`

### Backend — `process-chat-flow/index.ts`
Já propaga `ticket_config` inteiro do nó, então `tag_ids` será incluído automaticamente.

## Resumo de arquivos

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/ai-autopilot-chat/index.ts` | Hierarquia: `description_template` > `objective+smartFields` > fallback; + suporte a `tag_ids` na criação de ticket |
| `src/components/chat-flows/AIResponsePropertiesPanel.tsx` | Multi-select de Tags no ticket config |

## Deploy
- `ai-autopilot-chat`

