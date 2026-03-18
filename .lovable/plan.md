

# Plano: Adicionar Configuração de Ticket no Nó de IA

## Problema
O nó `ai_response` tem a ferramenta `create_ticket` disponível para a IA, mas **não existe nenhuma seção na UI de propriedades** para configurar como a IA deve criar tickets (departamento, categoria, prioridade, template de assunto). Atualmente esses valores estão hardcoded no `ai-autopilot-chat`.

## Solução

### 1. `AIResponsePropertiesPanel.tsx` — Nova seção "Criar Ticket"
Adicionar uma seção entre "Coleta Inteligente" e "Instruções Extras" com:

- **Toggle**: "Permitir IA criar tickets" (`enable_create_ticket`: boolean)
- Quando ativo, mostrar:
  - **Departamento** (select dos departamentos existentes via `useDepartments()`)
  - **Categoria** (select das categorias via `useTicketCategories()`)  
  - **Prioridade padrão** (select: low/medium/high/urgent)
  - **Template de assunto** (input com suporte a variáveis `{{variavel}}`)
  - **Template de descrição** (textarea com suporte a variáveis)

Dados salvos em `selectedNode.data.ticket_config`:
```json
{
  "enabled": true,
  "department_id": "uuid",
  "category": "financeiro",
  "default_priority": "high",
  "subject_template": "{{issue_type}} - {{customer_name}}",
  "description_template": "..."
}
```

### 2. `ai-autopilot-chat/index.ts` — Consumir `ticket_config` do flow_context
Na seção de `create_ticket` tool call (~linha 8063), usar os defaults do `flow_context.ticket_config` quando disponíveis:

- `department_id` → setar no insert do ticket
- `category` → usar em vez do hardcoded
- `default_priority` → usar como fallback quando a IA não especificar
- `subject_template` / `description_template` → interpolar variáveis

### 3. `process-chat-flow/index.ts` — Propagar `ticket_config` no flow_context
Garantir que quando o motor de fluxos monta o `flow_context` para o nó `ai_response`, inclua o campo `ticket_config` do `resolvedNode.data`.

### Dados que a IA pede ao cliente
A ferramenta `create_ticket` já define os parâmetros que a IA coleta via conversa:
- `subject` (assunto)
- `description` (descrição do problema)
- `issue_type` (tipo: saque, reembolso, defeito, etc.)
- `order_id` (opcional — pedido relacionado)
- `withdrawal_amount`, `pix_key` (para saques)

Com a `ticket_config`, o operador define os **defaults operacionais** (departamento, categoria, prioridade) — a IA continua coletando os dados do cliente normalmente.

