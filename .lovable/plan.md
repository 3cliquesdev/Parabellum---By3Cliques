

# Liberar Fila da IA para todos os roles

## Problema
Roles operacionais (sales_rep, support_agent, financial_agent, consultant) não conseguem ver a Fila IA porque o filtro de visibilidade (`applyVisibility`) restringe conversas ao departamento/assigned_to do usuário. Conversas em autopilot geralmente têm `assigned_to = null`, então ficam invisíveis para esses roles.

## Correção (3 arquivos, aditiva, sem risco)

### 1. `supabase/functions/get-inbox-counts/index.ts`
- Na query `aiQueueRes` (linha 236): **remover** o `applyVisibility` e usar query global (service role já tem acesso total)
- Todos os roles passam a ver a contagem real da fila IA

### 2. `src/hooks/useConversations.tsx`
- Após o bloco de role-based filtering (linha 157-178): adicionar condição para que quando o filtro ativo for `ai_queue`, **não aplicar** restrição de departamento/assigned_to
- Conversas `ai_mode = 'autopilot'` ficam visíveis para todos

### 3. `src/hooks/useInboxView.tsx`
- Mesma lógica: quando `aiMode === 'autopilot'` no filtro, pular o `applyVisibility` de role para que todos vejam a fila completa
- Na função `fetchInboxPage` (linha 332-347): condicionar o filtro de role para não se aplicar quando buscando fila IA

### 4. Broadcast button — expandir permissão
- Em `BroadcastAIQueueButton.tsx`: expandir `ALLOWED_ROLES` para incluir todos que têm `inbox.access`, ou remover a restrição de role (já que o botão só aparece na tab `ai_queue`)

## Impacto
- Zero alteração de lógica existente para outros filtros
- Apenas a aba "Fila IA" passa a mostrar todas as conversas em autopilot para qualquer role com acesso ao inbox
- Broadcast continua funcional (permissão expandida ou mantida conforme preferir)

