

# Fase 3.1 — Analytics Hub + Dashboards Dinamicos MVP

## Resumo

Transformar `/analytics` em Hub de navegacao, criar listagem de dashboards em `/dashboards` e viewer/editor em `/dashboard/:id` com blocos que consomem `report-query-engine`. Zero regressao.

## Arquivos Novos (7)

### 1. `src/pages/AnalyticsPremium.tsx`
- Copia exata do conteudo atual de `Analytics.tsx` (tabs premium com filtros, TeamPerformanceTable, etc.)
- Nenhuma mudanca de logica, apenas mover para rota `/analytics/premium`

### 2. `src/pages/Analytics.tsx` (reescrita como Hub)
- 4 cards de navegacao:
  - **Dashboards Dinamicos** (`/dashboards`) - icone LayoutDashboard
  - **Dashboard de Vendas (Sistema)** (`/?tab=vendas`) - icone TrendingUp
  - **Report Builder** (`/report-builder`) - icone FileText
  - **Analytics Premium** (`/analytics/premium`) - icone Sparkles
- Mantem guard de role (sales_rep redirecionado)
- Cards usam componente Card existente com Link do react-router-dom

### 3. `src/pages/DashboardsList.tsx`
- Lista dashboards via `supabase.from('dashboards').select('*').order('created_at', {ascending: false})`
- Botao "Novo Dashboard" abre Dialog com campos nome + descricao
- INSERT usa `created_by: (await supabase.auth.getUser()).data.user.id`
- Card para cada dashboard: nome, descricao, data, botoes Abrir (`/dashboard/:id`) e Excluir
- Excluir trata erro de RLS com toast
- React Query para cache e invalidacao

### 4. `src/pages/DashboardView.tsx`
- Carrega dashboard por `id` (useParams) + blocos via `dashboard_blocks`
- Header: nome do dashboard + botao "Adicionar Bloco"
- Grid responsivo: `grid grid-cols-1 md:grid-cols-2 gap-4`
- Cada bloco renderiza `DashboardBlockCard` ou `DashboardBlockTable` conforme `visualization_type`
- Botao remover em cada bloco

### 5. `src/hooks/useDashboards.ts`
- React Query hooks:
  - `useDashboardsList()` - lista dashboards
  - `useCreateDashboard()` - mutation INSERT
  - `useDeleteDashboard()` - mutation DELETE
  - `useDashboardBlocks(dashboardId)` - lista blocos
  - `useAddBlock()` - mutation INSERT em dashboard_blocks
  - `useRemoveBlock()` - mutation DELETE
  - `useReportDefinitions()` - lista report_definitions para o select do dialog
- Todas as mutations fazem `invalidateQueries` no sucesso

### 6. `src/components/dashboard-builder/AddBlockDialog.tsx`
- Dialog com:
  - Select de report_id (carrega report_definitions)
  - Select de visualization_type: "card" | "table"
  - Input de titulo (opcional)
- Ao salvar: INSERT em dashboard_blocks com defaults (position_x=0, position_y=0, width=1, height=1, sort_order = blocos.length, config_json={})

### 7. `src/components/dashboard-builder/DashboardBlockCard.tsx`
- Recebe `report_id`, `title`, `config_json`
- Chama `supabase.functions.invoke('report-query-engine', { body: { report_id, limit: 1 } })`
- Logica de extracao do valor:
  - Se `config_json.metric_key` existe, usa esse campo da primeira row
  - Senao, pega o primeiro campo numerico da primeira row
  - Fallback: "--"
- Renderiza: titulo em cima, valor grande centralizado

### 8. `src/components/dashboard-builder/DashboardBlockTable.tsx`
- Recebe `report_id`, `title`
- Chama `supabase.functions.invoke('report-query-engine', { body: { report_id, limit: 100 } })`
- Renderiza tabela dinamica:
  - Headers = Object.keys da primeira row
  - Linhas = todas as rows
  - Usa componentes Table/TableHeader/TableBody/TableRow/TableCell existentes

## Arquivos Modificados (2)

### 9. `src/App.tsx`
- Adicionar 3 lazy imports:
  - `AnalyticsPremium`
  - `DashboardsList` (nome `Dashboards` ja pode conflitar)
  - `DashboardView`
- Adicionar 3 rotas (antes do catch-all):
  - `/analytics/premium` -> AnalyticsPremium, permission `analytics.view`
  - `/dashboards` -> DashboardsList, permission `analytics.view`
  - `/dashboard/:id` -> DashboardView, permission `analytics.view`
- Todas dentro de `<ProtectedRoute><Layout>...</Layout></ProtectedRoute>`

### 10. `src/config/routes.ts`
- No grupo "Visao Geral", adicionar item:
  - `{ title: "Dashboards", href: "/dashboards", icon: LayoutDashboard, permission: "analytics.view" }`

## Nenhuma alteracao em

- Dashboard hardcoded (`/`) - intacto
- Report Builder (`/report-builder`) - intacto
- Edge Function `report-query-engine` - sem alteracao
- Tabelas/RLS - ja existem, zero migrations
- Deep-link `/?tab=vendas` - ja implementado

## Detalhes tecnicos

### Tipagem
As tabelas `dashboards` e `dashboard_blocks` ja existem no `types.ts` gerado. Usar tipagem via:
```typescript
type Dashboard = Database['public']['Tables']['dashboards']['Row'];
type DashboardBlock = Database['public']['Tables']['dashboard_blocks']['Row'];
```

### Schema das tabelas

**dashboards**: id, name, description, is_public, created_by (uuid NOT NULL), created_at, updated_at

**dashboard_blocks**: id, dashboard_id (FK), report_id (FK), visualization_type, title, config_json (jsonb, default {}), position_x, position_y, width, height, sort_order

### Chamada ao report-query-engine
```typescript
const { data, error } = await supabase.functions.invoke('report-query-engine', {
  body: { report_id: block.report_id, limit: 100 }
});
// data = { rows: [...], has_more: boolean }
```

### Grid de blocos
```
Desktop (md+):  2 colunas
Mobile:         1 coluna

Cada bloco ocupa 1 celula do grid (MVP simples, sem drag-and-drop)
```

## Criterios de aceite

| # | Teste | Esperado |
|---|-------|----------|
| 1 | Abrir `/analytics` | Ve 4 cards de navegacao |
| 2 | Clicar "Dashboard de Vendas (Sistema)" | Abre `/?tab=vendas` |
| 3 | Ir em `/dashboards` | Lista vazia ou com dashboards existentes |
| 4 | Criar "Novo Dashboard" | Aparece na lista |
| 5 | Abrir dashboard, adicionar bloco table | Ve tabela com dados reais |
| 6 | Adicionar bloco card | Ve KPI numerico |
| 7 | Remover bloco | Some da tela |
| 8 | `/` (Dashboard hardcoded) | Funciona normalmente |
| 9 | `/report-builder` | Funciona normalmente |

