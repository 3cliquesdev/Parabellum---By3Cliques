

# Fix: Classificação de Vendas no ai-governor

## Problemas Identificados

### 1. Hierarquia de classificação INVERTIDA (linha 108-123)
A função `classifyOrigin` verifica `affiliate_name` ANTES de `assigned_to`. Isso viola a regra definitiva do documento `sales-channel-attribution-rules.md`:
- **Regra**: `assigned_to` preenchido → SEMPRE Comercial, independente de afiliado
- **Atual**: deal com vendedor + afiliado → classificado como "parceiro" (errado)

### 2. Filtro por `created_at` em vez de `closed_at` (linhas 90-91)
Won deals são filtrados por `created_at`, mas deveriam usar `closed_at` (data do fechamento). Isso perde deals criados antes do período mas fechados no dia.

### 3. Comercial exige `pipeline_sales_reps` (linha 113)
A condição `commercialRepsIds.includes(deal.assigned_to)` exclui vendedores que têm `assigned_to` mas não estão na tabela `pipeline_sales_reps`. Pela regra, qualquer `assigned_to` preenchido = Comercial.

## Mudanças

### Arquivo: `supabase/functions/ai-governor/index.ts`

**A) Corrigir query de won deals** (linhas 90-91)
- Trocar `created_at` por `closed_at` nos filtros `.gte()` e `.lt()`

**B) Corrigir query de lost deals** (linhas 98-99)
- Trocar `created_at` por `closed_at` nos filtros

**C) Reescrever `classifyOrigin`** (linhas 108-123) seguindo a hierarquia correta:
```
1. assigned_to preenchido → 'comercial_interno'
2. lead_source = recorrência/renovação → 'kiwify:recorrencia'
3. affiliate_name preenchido → 'parceiro:NOME'
4. lead_source = formulario → 'formulario:...'
5. lead_source = whatsapp/webchat → 'canal:...'
6. is_organic_sale → 'kiwify:organico'
7. lead_source kiwify_* → 'kiwify:...'
8. fallback → 'direto'
```

**D) Remover dependência de `pipeline_sales_reps` para classificação**
- A query de `pipeline_sales_reps` (linhas 80-83) pode ser mantida para o ranking de reps, mas NÃO deve ser condição para classificar como comercial

## Impacto
- Upgrade puro: mesma estrutura de dados, mesmo template, mesmo parser
- Nenhuma mudança em tabelas, RLS ou outros arquivos
- Próximo relatório mostrará corretamente as vendas do time comercial e formulários

