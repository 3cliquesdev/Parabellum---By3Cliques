

# Adicionar campos V2 ao export do Relatório Comercial (V1)

## Problema
O V1 (`CommercialConversationsReport`) e o V2 (`ConversationsReport`) são páginas separadas — ambas existem corretamente. Porém o **export do V1** (`useExportCommercialConversationsCSV.tsx`) está sem as 3 colunas novas que a RPC já retorna.

## Alteração
**Arquivo**: `src/hooks/useExportCommercialConversationsCSV.tsx`

Na aba "Detalhado" (linhas 177-214):
1. Adicionar 3 headers ao array: `"Handoff"`, `"Tempo 1ª Resposta Humana"`, `"Tempo Resolução Humana"`
2. Adicionar os 3 valores no mapeamento de cada row:
   - `row.handoff_at` → formatado com `format(new Date(...), "dd/MM/yyyy HH:mm")`
   - `row.human_first_response_seconds` → `formatDuration()`
   - `row.human_resolution_seconds` → `formatDuration()`

Nenhuma mudança SQL necessária — a RPC já retorna esses campos.

