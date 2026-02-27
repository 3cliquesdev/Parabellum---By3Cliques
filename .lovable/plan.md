

# Relatório de Conversas — Tempo Médio + Tags

## Contexto

O banco já possui todas as tabelas necessárias: `conversations`, `messages` (com `is_ai_generated`, `sender_type`), `conversation_assignment_logs`, `conversation_tags`, `tags`, `conversation_ratings`. Não é necessário criar tabelas novas — apenas uma RPC que calcula as métricas de tempo e uma nova página.

Os sender_types são: `contact` (cliente), `user` (agente/IA), `system`. Mensagens de IA são identificadas por `is_ai_generated = true AND sender_type = 'user'`. Handoff é detectado via `conversations.handoff_executed_at`. Tags já possuem `category` (conversation, customer, ticket, etc.).

## Plano de Implementação

### 1. RPC: `get_inbox_time_report` (Migration SQL)

Função que retorna 1 linha por conversa com:

**Identificação:** `conversation_id`, `short_id`, `channel`, `status`, `contact_name`, `contact_phone`, `assigned_agent_name`, `department_name`

**Timestamps calculados via LATERAL joins em `messages`:**
- `customer_first_msg_at` = MIN(messages WHERE sender_type='contact')
- `ai_first_msg_at` = MIN(messages WHERE is_ai_generated=true)
- `handoff_at` = conversations.handoff_executed_at
- `agent_first_msg_at` = MIN(messages WHERE sender_type='user' AND is_ai_generated=false AND created_at > handoff_at)
- `resolved_at` = conversations.closed_at

**Métricas (segundos):**
- `ai_first_response_sec` = ai_first_msg_at - customer_first_msg_at
- `ai_duration_sec` = handoff_at - ai_first_msg_at
- `time_to_handoff_sec` = handoff_at - customer_first_msg_at
- `human_pickup_sec` = agent_first_msg_at - handoff_at
- `human_resolution_sec` = resolved_at - agent_first_msg_at
- `total_resolution_sec` = resolved_at - customer_first_msg_at

**CSAT:** join em `conversation_ratings`

**Tags:** `tags_all` (text[]) via LATERAL em `conversation_tags` + `tags`

**Filtros:** `p_start`, `p_end`, `p_department_id`, `p_agent_id`, `p_status`, `p_channel`, `p_tag_id`, `p_transferred` (boolean), `p_search`, `p_limit`, `p_offset`

**Agregados KPI (retornados como colunas extras via window):**
- p50/p90 de ai_first_response
- % resolvido sem humano (handoff_at IS NULL AND status='closed')
- médias de cada métrica de tempo
- CSAT médio + taxa de resposta

### 2. Nova Página: `src/pages/InboxTimeReport.tsx`

Rota: `/reports/inbox-time` (adicionar em App.tsx e Reports.tsx)

**Layout:**
- Header com botão voltar para /reports
- Filtros: Período, Canal, Status, Departamento, Agente, Tag (multi-select com catálogo de tags), Transferido (sim/não), Busca
- KPI Cards no topo (6 cards): p50 1ª resposta IA, % resolvido sem humano, tempo médio IA→handoff, tempo médio fila humano, tempo médio humano→resolução, CSAT médio
- Tabela paginada com colunas: Protocolo, Canal, Atendente, 1ª msg cliente, SLA IA, Tempo IA, Fila humano, Tempo humano, Total, CSAT, Tags
- Export Excel (reutilizar padrão do useExportConversationsCSV)

### 3. Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar RPC `get_inbox_time_report` |
| `src/hooks/useInboxTimeReport.ts` | Hook react-query para a RPC |
| `src/hooks/useExportInboxTimeCSV.ts` | Hook de exportação Excel |
| `src/hooks/useTags.ts` | (já existe) reutilizar para filtro de tags |
| `src/pages/InboxTimeReport.tsx` | Página completa com KPIs + filtros + tabela |
| `src/components/reports/inbox/InboxTimeKPICards.tsx` | Cards de KPI |
| `src/components/reports/inbox/InboxTimeTable.tsx` | Tabela paginada |
| `src/App.tsx` | Adicionar rota `/reports/inbox-time` |
| `src/pages/Reports.tsx` | Adicionar card no menu Atendimento |

### 4. Detalhes Técnicos

- A RPC calcula KPIs agregados usando window functions (`percentile_cont`, `AVG`, `COUNT`) retornados em cada linha (ou em uma query separada de totais) — para eficiência, usaremos 2 chamadas: uma para KPIs (sem limit/offset) e outra para a tabela paginada, ou calcular via CTE na mesma RPC retornando os KPIs na primeira linha.
- Tags são filtradas via `p_tag_id UUID` — a RPC faz `EXISTS (SELECT 1 FROM conversation_tags ct WHERE ct.conversation_id = c.id AND ct.tag_id = p_tag_id)`.
- `p_transferred` boolean: `TRUE` = handoff_executed_at IS NOT NULL, `FALSE` = IS NULL, `NULL` = todos.

