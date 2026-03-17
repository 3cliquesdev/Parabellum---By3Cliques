

# Liberar Visibilidade da Fila IA para Todos os Atendentes

## Problema Identificado
A política RLS `canonical_select_conversations` na tabela `conversations` restringe agentes (support_agent, sales_rep, financial_agent, consultant) a verem apenas conversas **não atribuídas do mesmo departamento**. Isso impede que vejam a fila completa da IA.

## Solução
Atualizar a política RLS `canonical_select_conversations` para permitir que **todos os agentes autenticados** vejam conversas em modo autopilot (fila IA) independente do departamento.

### Alteração na política RLS
Adicionar uma nova condição OR na política SELECT:

```text
Condição atual (agentes):
  status = 'open' AND assigned_to IS NULL 
  AND role IN (sales_rep, support_agent, financial_agent, consultant)
  AND department = profile.department   ← BLOQUEIO

Nova condição adicional:
  ai_mode = 'autopilot' AND status != 'closed'
  AND has_any_role(auth.uid(), [todos os roles não-user])
```

Isso permite que qualquer agente autenticado (não-cliente) veja conversas na fila da IA, mantendo as restrições de departamento para as demais filas.

### Resumo técnico
- **1 migração SQL**: DROP + CREATE da política `canonical_select_conversations` com a condição adicional para `ai_mode = 'autopilot'`
- Zero alterações no frontend — sidebar e botão "Assumir" já existem
- A permissão `inbox.access` já está habilitada para todos os roles

