
# Adicionar configuracao de SLA no dialog de Categorias

## Resumo

Ao criar ou editar uma Categoria (que ja tem prioridade definida), o admin tambem define os tempos de SLA (tempo de primeira resposta e tempo de resolucao). Esses valores sao salvos automaticamente na tabela `sla_policies` vinculados a `category_id` + `priority`.

## Como funciona hoje

- Tabela `sla_policies` existe com campos: `category_id`, `priority`, `response_time_value`, `response_time_unit`, `resolution_time_value`, `resolution_time_unit`
- Tabela esta **vazia** -- nenhuma politica configurada
- Nao existe UI para gerenciar SLA em nenhum lugar da aplicacao

## Onde sera configurado

Na aba **Categorias** (dentro de Depart. & Operacoes), ao clicar em "Editar" ou "+ Nova Categoria", o dialog ja mostra nome, descricao, cor e prioridade. Vamos adicionar:

- **Tempo de Primeira Resposta**: valor numerico + unidade (horas / horas uteis / dias uteis)
- **Tempo de Resolucao**: valor numerico + unidade (horas / horas uteis / dias uteis)

## Etapas

### 1. Atualizar CategoryDialog com campos de SLA

**Arquivo:** `src/components/CategoryDialog.tsx`

Adicionar dois grupos de campos abaixo da prioridade:

- Input numerico "Tempo de 1a Resposta" + Select de unidade (hours / business_hours / business_days)
- Input numerico "Tempo de Resolucao" + Select de unidade

Ao abrir para edicao, buscar a politica existente em `sla_policies` para pre-preencher os campos.

### 2. Salvar/atualizar sla_policies no submit

Quando o admin salva a categoria, alem de salvar na `ticket_categories`, tambem faz upsert na `sla_policies`:

```text
category_id = categoria.id
priority = categoria.priority
response_time_value = valor informado
response_time_unit = unidade informada
resolution_time_value = valor informado  
resolution_time_unit = unidade informada
is_active = true
```

Se a categoria ja tinha uma politica, atualiza. Se nao, cria.

### 3. Mostrar SLA no card da categoria (Departments.tsx)

No card de cada categoria na listagem, mostrar um indicador visual do SLA configurado (ex.: "SLA: 2h resposta / 24h resolucao"), similar ao que ja acontece com "Auto-fecha em 30 min" nos departamentos.

### 4. Invalidar cache de sla-policies

Ao salvar, invalidar a query `['sla-policies']` para manter consistencia com qualquer parte do sistema que consulte politicas de SLA.

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/components/CategoryDialog.tsx` | Adicionar campos de SLA (resposta + resolucao) e logica de upsert |
| `src/pages/Departments.tsx` | Mostrar indicador de SLA no card da categoria |

## Impacto

- Zero regressao: nenhuma feature existente e alterada
- A tabela `sla_policies` passa a ser populada automaticamente ao configurar categorias
- O hook `useSLAPolicyForTicket` que ja existe vai encontrar as politicas corretamente
- Categorias existentes sem SLA continuam funcionando (campos opcionais)
