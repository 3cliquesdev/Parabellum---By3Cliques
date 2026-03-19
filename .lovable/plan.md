

# Fix: Templates não aparecem no Dialog do Pipeline

## Diagnóstico

O banco tem 4 templates ativos (`comercial`, `comercial_v4`, `comercial_v5`, `suporte`), todos com mesmo `instance_id` e `is_active: true`. Não há filtro por categoria no código. O problema tem duas causas:

1. **ScrollArea muito pequena** (`max-h-[200px]`) — com 4 templates, os últimos ficam escondidos e mal dá pra perceber que tem scroll
2. **Cache do React Query** — a query `["whatsapp-templates-active", instanceId]` pode ter sido cacheada quando havia menos templates. Não há invalidação ao abrir o dialog

## Correções

### 1. Aumentar altura do ScrollArea e forçar refetch
**Arquivo:** `src/components/pipeline/PipelineTemplateDialog.tsx`

- Aumentar `max-h-[200px]` para `max-h-[340px]` — cabe ~4-5 templates sem scroll
- Adicionar `refetchOnMount: "always"` na query de templates para garantir dados frescos ao abrir o dialog
- Aplicar a mesma correção no `ReengageTemplateDialog.tsx` se tiver o mesmo problema

### 2. Resultado
- Todos os templates ativos aparecem imediatamente ao abrir o dialog
- Novos templates adicionados aparecem sem precisar recarregar a página

