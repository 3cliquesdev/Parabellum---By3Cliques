
# Plano: Roteamento por Preferência do Contato (Overrides) ✅

## Status: IMPLEMENTADO

## Resumo

Camada de roteamento baseada em overrides configuráveis por contato e organização. O sistema resolve o destino na transferência usando a cadeia: **Atendente preferido → Departamento preferido → Departamento padrão da Organização → Fallback do nó**.

## O que foi feito

### 1. Migração ✅
- `contacts.preferred_agent_id` (uuid, FK profiles)
- `contacts.preferred_department_id` (uuid, FK departments)
- `organizations.default_department_id` (uuid, FK departments)

### 2. Frontend: Transfer Node ✅
- Novo tipo `preferred` no TransferPropertiesPanel com info box da cadeia de prioridade
- TransferNode exibe badge "Preferência do Contato" + fallback dept

### 3. Frontend: ContactDialog ✅
- Selects para "Atendente preferido" e "Departamento preferido" na seção Associações

### 4. Frontend: OrganizationDialog ✅
- Select "Departamento padrão" no formulário

### 5. Backend: buildVariablesContext ✅
- Expõe `contact_preferred_agent_id`, `contact_preferred_department_id`, `org_default_department_id`

### 6. Backend: meta-whatsapp-webhook ✅
- Resolve `transfer_type='preferred'` com cadeia de prioridade completa
- Não interfere com lógica de consultor existente
