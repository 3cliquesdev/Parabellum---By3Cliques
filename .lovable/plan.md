
# Hardening DEAL_SELECT: Remover `*` com campos explicitos

## Diagnostico

O `DEAL_SELECT` atual usa `*` na base, trazendo todas as 40+ colunas da tabela deals. O inventario completo do frontend mostra que muitos campos sao usados em diferentes componentes (KanbanCard, DealDialog, LeadInfoPopover, hooks de metricas, etc.), incluindo campos acessados via `(deal as any)`.

**Problema**: como `Tables<"deals">` e o tipo usado em todo o sistema e o DealDialog edita praticamente todos os campos, remover colunas do select quebraria silenciosamente os formularios de edicao e features como "Cliente Existente", "Lead Info 360", metricas por canal, etc.

## Inventario de campos usados no frontend

| Campo | Usado em |
|---|---|
| id, title, value, status, stage_id, pipeline_id | Kanban, cards, filtros, drag-drop |
| contact_id, organization_id, assigned_to | Cards, dialog, filtros, atribuicao |
| currency | KanbanCard, RottenDealsWidget, ContactDetailsSidebar, UnifiedTimeline |
| probability, expected_close_date | Filtros, metricas, forecast |
| created_at, updated_at, closed_at | Filtros, ordenacao, rotten detection |
| lost_reason, lead_source | LostReasonDialog, filtros, metricas por canal |
| lead_email, lead_phone | KanbanCard fallback, LeadInfoPopover |
| is_returning_customer, existing_products | KanbanCard badge, DealDialog upsell alert |
| is_organic_sale, affiliate_name, kiwify_offer_id | useWonDealsByChannel, useSalesByRep, useLeadsBySource |
| net_value, gross_value | useWonDealsByChannel revenue calc |
| product_id | DealDialog form, PlaybookExecutions |
| tracking_code, expected_revenue, success_criteria, pain_points, churn_risk | DealDialog form fields |
| affiliate_commission, affiliate_email | Metricas de afiliados |
| kiwify_fee, pending_kiwify_event_id, pending_payment_at | Fluxo Kiwify |
| became_rotten_at, rotten_notified_at, rotten_escalated_at | useRottenDeals |
| lead_whatsapp_id | Integracao WhatsApp |

**Conclusao do inventario**: Praticamente TODOS os 40 campos da tabela sao usados em algum lugar do frontend. Remover qualquer um deles quebraria features silenciosamente.

## Decisao de Engenharia

Dado que o DealDialog (formulario de edicao) usa `Tables<"deals">` e acessa todos os campos, e hooks de metricas (useSalesByRep, useWonDealsByChannel, useLeadsBySource) tambem consomem campos como `kiwify_offer_id`, `affiliate_name`, `is_organic_sale`, `net_value`, etc., a abordagem correta e:

**Listar TODOS os campos explicitamente no DEAL_SELECT** -- isso remove o `*` (que e o objetivo) sem risco de regressao, e deixa claro quais campos sao buscados.

O ganho real de payload sera minimo neste caso (nao ha colunas TEXT/JSON gigantes nao usadas), mas o padrao fica correto e auditavel.

## Mudancas

### 1. `src/lib/select-fields.ts` -- DEAL_SELECT explicito

Substituir o `*` por todos os campos da tabela deals listados explicitamente:

```
id, title, value, status, stage_id, pipeline_id,
contact_id, organization_id, assigned_to,
probability, expected_close_date, expected_revenue,
created_at, updated_at, closed_at,
currency, lost_reason, lead_source,
lead_email, lead_phone, lead_whatsapp_id,
is_returning_customer, existing_products,
is_organic_sale, affiliate_name, affiliate_email, affiliate_commission,
kiwify_offer_id, kiwify_fee, net_value, gross_value,
pending_kiwify_event_id, pending_payment_at,
product_id, tracking_code,
success_criteria, pain_points, churn_risk,
became_rotten_at, rotten_notified_at, rotten_escalated_at
```

Mantendo os joins existentes (contacts, organizations, assigned_user).

### 2. `src/pages/Deals.tsx` -- adicionar usePerformanceLog

Importar `usePerformanceLog` e adicionar no componente:

```typescript
const { data: deals, isLoading: dealsLoading } = useDeals(selectedPipeline, dealFilters);
usePerformanceLog('Deals', !dealsLoading);
```

### 3. `src/components/dashboard/OverviewDashboardTab.tsx` -- ja tem perf log (nenhuma mudanca)

Ja implementado na fase anterior.

## Arquivos modificados

| Arquivo | Tipo | Mudanca |
|---|---|---|
| `src/lib/select-fields.ts` | EDIT | Substituir `*` por campos explicitos no DEAL_SELECT |
| `src/pages/Deals.tsx` | EDIT | Adicionar usePerformanceLog |

## Impacto

- Zero regressao: todos os campos usados no frontend estao presentes no select explicito
- DEAL_SELECT fica auditavel (sabe-se exatamente o que vem do banco)
- Perf log em /deals permite medir tempo de carregamento
- useDeals ja tem abortSignal e staleTime (nenhuma mudanca necessaria no hook)
