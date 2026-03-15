

# Buscar nome do produto da tabela `mabang_order_item`

## Mudanças

### 1. Edge Function `lookup-order-by-tracking/index.ts`
Após obter o `platformOrderId`, fazer uma query adicional na tabela `mabang_order_item` para buscar os títulos dos produtos associados ao pedido:

```sql
SELECT title FROM mabang_order_item WHERE platform_order_id = ? AND title IS NOT NULL
```

Retornar no response um novo campo `product_titles: string[]` com os nomes encontrados.

### 2. `AdminReturnDialog.tsx`
- Atualizar a interface `LookupResult` para incluir `product_titles?: string[]`
- Exibir os produtos no bloco de resultado junto com o Seller, algo como:

```tsx
{lookupResult?.found && lookupResult.product_titles?.length > 0 && (
  <div>
    <p className="text-xs text-muted-foreground">Produto(s)</p>
    {lookupResult.product_titles.map((t, i) => (
      <p key={i} className="font-medium text-sm">{t}</p>
    ))}
  </div>
)}
```

Arquivos a modificar:
- `supabase/functions/lookup-order-by-tracking/index.ts`
- `src/components/support/AdminReturnDialog.tsx`

