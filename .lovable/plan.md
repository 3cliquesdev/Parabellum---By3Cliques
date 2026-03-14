

## Problema

O hook `useKnowledgeCategories` busca artigos da tabela `knowledge_articles` e extrai categorias únicas no lado do cliente. Porém:

1. **Limite de 1000 linhas** — Supabase retorna no máximo 1000 registros por padrão. Se existem mais de 1000 artigos, categorias de artigos além desse limite simplesmente não aparecem.
2. **Ineficiência** — Busca todos os artigos só para extrair o campo `category`.

## Solução

Substituir a query client-side por uma **database function** que retorna categorias distintas diretamente no banco, sem limite de linhas.

### Passo 1 — Criar função SQL no banco

```sql
CREATE OR REPLACE FUNCTION public.get_distinct_knowledge_categories()
RETURNS TABLE(category TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ka.category
  FROM knowledge_articles ka
  WHERE ka.category IS NOT NULL
    AND ka.category != ''
  ORDER BY ka.category;
$$;
```

### Passo 2 — Atualizar `useKnowledgeCategories.tsx`

Trocar a query atual por uma chamada RPC:

```typescript
const { data, error } = await supabase.rpc("get_distinct_knowledge_categories");
```

Retornar `data.map(row => row.category)` — sem necessidade de deduplicar no cliente.

### Resultado

- Todas as categorias aparecem independente do número de artigos
- Query mais rápida (DISTINCT no banco vs. buscar 1000+ linhas)
- Sem mudança na interface — o hook continua retornando `string[]`

