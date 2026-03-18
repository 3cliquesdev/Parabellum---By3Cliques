
Objetivo: fazer com que atendentes vejam de forma confiável as conversas da Fila IA para monitorar a automação e assumir quando necessário.

Diagnóstico
- O backend já entrega conversas da IA para atendentes operacionais.
- O problema mais provável está no carregamento do inbox: a tela busca até 500 conversas “misturadas” e só depois filtra a aba `ai_queue` no frontend.
- Isso pode “sumir” com conversas da IA quando o atendente já tem muitas conversas visíveis no conjunto geral.
- Há um segundo risco: filtros de departamento/agente da URL podem continuar restringindo a Fila IA, mesmo quando a intenção é mostrar a fila global.

Plano de ajuste
1. Mover o filtro da Fila IA para o banco
- Em `src/hooks/useInboxView.tsx`, adicionar suporte a um modo explícito de consulta para `ai_queue`.
- Quando a tela estiver em `ai_queue`, a query deve buscar diretamente:
  - `status != closed`
  - `assigned_to is null`
  - `ai_mode in ('autopilot', 'waiting_human')`
- Isso evita depender do filtro client-side depois do `limit(500)`.

2. Passar o tipo de fila ativo da tela para o hook
- Em `src/pages/Inbox.tsx`, enviar o filtro atual (`ai_queue`, `human_queue`, etc.) para `useInboxView`.
- Manter o filtro client-side só como proteção extra, mas a seleção principal deve acontecer na query.

3. Garantir que a Fila IA seja global para atendentes
- Em `src/hooks/useInboxView.tsx`, preservar a regra de visibilidade global da IA para roles operacionais (`support_agent`, `sales_rep`, `financial_agent`, `consultant`).
- Ajustar a lógica para que a consulta da `ai_queue` não seja “poluída” por conversas humanas/departamento antes do limit.

4. Evitar filtros residuais escondendo a Fila IA
- Em `src/pages/Inbox.tsx`, revisar a aplicação de `departmentFilter` e `agentFilter`.
- Para `ai_queue`, não deixar filtros residuais esconderem a fila global, a menos que isso seja uma filtragem intencional da própria aba.

5. Alinhar badges e lista
- Revisar `supabase/functions/get-inbox-counts/index.ts` para garantir que o contador da Fila IA use exatamente a mesma definição da lista:
  - `autopilot + waiting_human`
  - sem responsável
  - não encerradas

Arquivos a ajustar
- `src/hooks/useInboxView.tsx`
- `src/pages/Inbox.tsx`
- `supabase/functions/get-inbox-counts/index.ts`

Resultado esperado
- Atendentes verão a Fila IA completa de forma consistente.
- Conversas da IA não desaparecerão por causa do limite da query geral.
- A contagem da aba e a lista exibida ficarão coerentes.
- O comportamento ficará alinhado com a regra de negócio: IA trabalha sozinha, e o atendente monitora e assume quando necessário.

Detalhe técnico
```text
Hoje:
consulta geral (limit 500) -> frontend filtra ai_queue

Depois:
consulta já filtrada para ai_queue -> frontend apenas renderiza
```
