

## Executar Migration do Analytics / Report Builder

### Escopo
Criar as 10 tabelas do modulo Analytics/Report Builder em uma unica transacao, com RLS, indexes e seeds iniciais.

### Tabelas a criar

| # | Tabela | RLS | Indexes |
|---|---|---|---|
| 1 | `data_catalog` | Leitura: todos. Escrita: admin/manager | entity, entity+category, sensitive |
| 2 | `semantic_metrics` | Leitura: todos. Escrita: admin/manager | entity_base, is_active |
| 3 | `report_definitions` | Proprio + publico + admin/manager | created_by, is_public, base_entity |
| 4 | `report_fields` | Herda do report parent | report_id, entity+field |
| 5 | `report_metrics` | Herda do report parent | report_id |
| 6 | `report_filters` | Herda do report parent | report_id |
| 7 | `report_groupings` | Herda do report parent | report_id |
| 8 | `dashboards` | Proprio + publico + admin/manager | created_by, is_public |
| 9 | `dashboard_blocks` | Herda do dashboard parent | dashboard_id, report_id |
| 10 | `ai_events` | Restrito admin/manager | entity_type+id, created_at, department_id |

### Seeds
- `data_catalog`: 15 campos (deals + contacts)
- `semantic_metrics`: 2 metricas (taxa conversao + receita total)

### Validacao pos-execucao
1. Confirmar 10 tabelas criadas
2. RLS habilitado em todas
3. Policies aplicadas corretamente
4. Seeds inseridos (data_catalog >= 15, semantic_metrics >= 2)
5. Zero impacto nas tabelas existentes

### Detalhes tecnicos
- Usa funcao `is_manager_or_admin()` ja existente no banco
- Policies de tabelas filhas (report_fields, report_metrics, etc.) fazem subquery na tabela pai
- `ai_events` tem acesso restrito apenas admin/manager (leitura e escrita)
- Constraint UNIQUE em `data_catalog(entity, field_name)` e `semantic_metrics(name)` para seeds idempotentes
- Seeds usam `ON CONFLICT DO NOTHING` para seguranca

