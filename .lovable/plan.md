

# Relatório de Conversas V2

## Problemas Identificados

### 1. Tags vazias no relatório e na exportação
A RPC `get_commercial_conversations_report` usa `t.category = 'conversation'` no LATERAL JOIN `tag_calc` para buscar `last_conversation_tag`. Porém, muitas tags estão com `category = 'customer'` (ex: "9.05 Atendimento Fora do Horário"). Isso faz com que conversas com tags apareçam como "-" tanto na tabela quanto no CSV.

O campo `tags_all` na verdade funciona corretamente (busca todas as tags), mas a tabela UI só exibe `last_conversation_tag` (que está filtrado errado), e o CSV exporta `tags_all` que deveria estar ok — mas preciso confirmar se o split por `protected_conversation_tags` não está excluindo tags indevidamente.

### 2. Novas métricas de tempo solicitadas
O usuário quer:
- **Hora do handoff para humano**: quando a IA transferiu para atendente
- **Tempo de primeira resposta humana**: tempo entre handoff e primeira mensagem do agente humano
- **Tempo de resolução humano**: tempo entre handoff e encerramento da conversa

Dados disponíveis:
- `ai_events` com `event_type = 'state_transition_handoff_to_human'` tem o timestamp do handoff
- `conversation_assignment_logs` tem o primeiro assignment humano
- `messages` com `sender_type = 'agent'` e `sender_id IS NOT NULL` tem a primeira resposta humana

## Plano de Implementação

### Etapa 1: Atualizar a RPC SQL (migration)
Criar nova versão da `get_commercial_conversations_report` com:
- **Fix tags**: Remover filtro `t.category = 'conversation'` no `tag_calc` — usar todas as tags para `last_conversation_tag`
- **Novo campo `handoff_at`**: LATERAL JOIN em `ai_events` buscando `MIN(created_at)` onde `event_type IN ('state_transition_handoff_to_human', 'ai_transfer')`
- **Novo campo `human_first_response_seconds`**: tempo entre `handoff_at` e primeira mensagem de agente humano após o handoff
- **Novo campo `human_resolution_seconds`**: tempo entre `handoff_at` e `closed_at`

### Etapa 2: Atualizar o hook e tipos (TypeScript)
Adicionar os novos campos no `ReportRow` em `useCommercialConversationsReport.tsx`:
- `handoff_at: string | null`
- `human_first_response_seconds: number | null`
- `human_resolution_seconds: number | null`

### Etapa 3: Atualizar a tabela UI
Em `CommercialDetailedTable.tsx`:
- Corrigir coluna "Tag" para mostrar `tags_all` (join) em vez de `last_conversation_tag` quando este for nulo
- Adicionar colunas: "Handoff", "TFR Humano", "Resolução Humano"

### Etapa 4: Atualizar a exportação CSV
Em `useExportConversationsCSV.tsx`:
- Adicionar colunas: "Hora Handoff", "Tempo 1ª Resposta Humana", "Tempo Resolução Humana"
- Garantir que "Tags" exporte `tags_all` completo (já faz, mas validar)

## Arquivos Envolvidos
- Nova migration SQL (RPC V2)
- `src/hooks/useCommercialConversationsReport.tsx` (tipos)
- `src/components/reports/commercial/CommercialDetailedTable.tsx` (UI)
- `src/hooks/useExportConversationsCSV.tsx` (export)

