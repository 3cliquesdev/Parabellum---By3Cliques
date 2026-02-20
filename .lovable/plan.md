

## Fase 2 - Analytics / Report Builder (Catalogo + Query Engine + UI MVP)

### Sequencia de Execucao

**Passo 1 - Migration SQL (2A + 2B)**

Uma unica migration que:

1. Popula `data_catalog` com todas as colunas de todas as BASE TABLES do schema public, excluindo as 10 tabelas do modulo analytics. Atualmente existem 15 seeds (deals/contacts com category "Vendas"/"CRM"). Novos registros usam `category = 'Auto'` e `ON CONFLICT DO NOTHING`.

2. Mapeamento de tipos conforme especificado (uuid, text, number, date, boolean, jsonb).

3. Flags automaticos:
   - `is_sensitive = true` via regex expandida incluindo token, password, secret, mobile, whats, zip, postal
   - `allow_group = false` para jsonb
   - `allow_aggregate = true` somente para number

4. Cria RPC `exec_report_sql(p_sql text)`:
   - SECURITY INVOKER
   - Bloqueia multi-statement (`;` antes do fim)
   - Bloqueia nao-SELECT/WITH via regex no inicio
   - Bloqueia palavras proibidas: INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE
   - Bloqueia SQL com mais de 20000 caracteres
   - Retorna `COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)`
   - GRANT EXECUTE TO authenticated

---

**Passo 2 - Edge Function `report-query-engine`**

Arquivo: `supabase/functions/report-query-engine/index.ts`

Config.toml: `verify_jwt = false` (validacao manual com getClaims)

Fluxo:
1. CORS headers
2. 401 sem Authorization bearer (getClaims)
3. POST body: `{report_id, definition_inline, limit, offset}`
4. Carrega report definition + fields/metrics/filters/groupings do banco (ou usa inline)
5. Valida campos contra data_catalog:
   - entity + field_name deve existir
   - Bloqueia is_sensitive para nao-admin/manager (consulta user_roles)
   - Respeita allow_filter / allow_group / allow_aggregate
6. Allowlist de JOINs hardcoded:
   - deals -> contacts, stages, pipelines, profiles
   - conversations -> contacts, profiles, departments
   - tickets -> contacts, profiles
7. Limites de complexidade: max 25 colunas, max 3 groupings, max 3 joins
8. Gera SQL dinamico com allowlist de operadores e agregacoes
9. Executa via supabase.rpc('exec_report_sql')
10. Retorna `{ rows, has_more }` (limit+1 trick para has_more)

---

**Passo 3 - Hooks (3 arquivos novos)**

| Arquivo | Funcao |
|---|---|
| `src/hooks/useDataCatalog.ts` | Busca entidades unicas e campos do data_catalog via supabase client |
| `src/hooks/useReportQuery.ts` | Executa report via edge function (supabase.functions.invoke) |
| `src/hooks/useReportDefinitions.ts` | CRUD de report_definitions + salvar campos/metricas/filtros/agrupamentos |

---

**Passo 4 - Componentes UI (8 arquivos novos em `src/components/report-builder/`)**

| Componente | Funcao |
|---|---|
| `EntitySelector.tsx` | Select de entidades disponiveis (distinct entity do catalogo) |
| `FieldPicker.tsx` | Checkboxes com campos da entidade selecionada |
| `FilterBuilder.tsx` | Adicionar filtros: campo + operador + valor |
| `GroupingConfig.tsx` | Selecionar campos de agrupamento + time grain para datas |
| `MetricConfig.tsx` | Configurar agregacoes (count, sum, avg, min, max) sobre campos numericos |
| `ReportPreview.tsx` | Tabela renderizando os rows retornados pela engine |
| `SaveReportDialog.tsx` | Dialog para salvar report com nome e descricao |
| `ReportBuilderToolbar.tsx` | Toolbar com botoes Preview e Salvar |

---

**Passo 5 - Pagina e Rotas**

| Arquivo | Mudanca |
|---|---|
| `src/pages/ReportBuilder.tsx` | Nova pagina com layout em etapas usando PageContainer/PageHeader/PageContent |
| `src/App.tsx` | Adicionar lazy import (linha ~88) + rota protegida `/report-builder` com permission `analytics.view` (linha ~215) |
| `src/config/routes.ts` | Adicionar item "Report Builder" no grupo "Gestao" com href `/report-builder`, icon `FileText`, permission `analytics.view` |

---

### Detalhes Tecnicos

**RPC exec_report_sql - Validacoes de seguranca:**
```text
1. length(p_sql) > 20000 -> RAISE EXCEPTION
2. p_sql ~ E';\\s*\\S' -> RAISE EXCEPTION 'Multi-statement not allowed'
3. upper(btrim(p_sql)) !~ '^(SELECT|WITH)' -> RAISE EXCEPTION 'Only SELECT allowed'
4. p_sql ~* '\\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\\b' -> RAISE EXCEPTION
```

**Edge Function - SQL gerado (exemplo):**
```text
SELECT d.status, SUM(d.amount) AS total_amount
FROM deals d
WHERE d.status IS NOT NULL
GROUP BY d.status
ORDER BY d.status
LIMIT 101 OFFSET 0
```

**Allowlist de operadores no edge function:**
eq (=), neq (!=), gt (>), lt (<), gte (>=), lte (<=), contains (ILIKE), not_contains (NOT ILIKE), between (BETWEEN), in (IN), is_null (IS NULL), is_not_null (IS NOT NULL)

**Agregacoes permitidas:**
count (COUNT), sum (SUM), avg (AVG), min (MIN), max (MAX), count_distinct (COUNT(DISTINCT))

**Time grain (para GroupingConfig com campos date):**
day, week, month, quarter, year -> mapeados para date_trunc()

---

### Criterios de Aceite

- data_catalog populado com todas as entidades do schema public (~150+ tabelas)
- Regex de sensiveis aplicada (incluindo token, password, secret, mobile, whats, zip, postal)
- RPC bloqueia multi-statement, nao-SELECT e palavras proibidas
- Edge Function retorna 401 sem bearer token
- Query engine roda report simples (deals por status com sum(amount))
- UI cria, salva e exibe preview de um relatorio
- Campos sensiveis bloqueados para nao-admin/manager
- Zero regressao em features existentes

