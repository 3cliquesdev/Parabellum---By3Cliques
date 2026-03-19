

# Cadastro de Product Tags — CRUD + Dropdown

## Problema
Atualmente, product tags são digitadas manualmente (texto livre), causando erros de digitação e inconsistência. O usuário quer um sistema igual ao de categorias: cadastrar tags previamente e selecionar via dropdown.

## Solução

### 1. Criar tabela `product_tags` no banco
```sql
CREATE TABLE public.product_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read
CREATE POLICY "Authenticated users can read product_tags"
  ON public.product_tags FOR SELECT TO authenticated USING (true);

-- Policy: authenticated users can manage
CREATE POLICY "Authenticated users can manage product_tags"
  ON public.product_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed com as product tags existentes
INSERT INTO public.product_tags (name)
SELECT DISTINCT unnest(product_tags) FROM public.knowledge_articles
WHERE product_tags IS NOT NULL AND array_length(product_tags, 1) > 0
ON CONFLICT (name) DO NOTHING;
```

### 2. Criar hook `useProductTags` (CRUD)
Novo arquivo `src/hooks/useProductTags.tsx` com:
- `useProductTags()` — lista todas as product tags da nova tabela
- `useCreateProductTag()` — criar nova tag
- `useDeleteProductTag()` — deletar tag

### 3. Criar componente de gerenciamento `ProductTagManager`
Novo componente `src/components/knowledge/ProductTagManager.tsx`:
- Dialog acessível via botão na página de Knowledge Base (ao lado de "Curadoria")
- Lista as tags cadastradas com botão de deletar
- Input + botão para adicionar nova tag
- Design simples, similar ao TagDialog existente

### 4. Atualizar `KnowledgeArticleDialog` — Dropdown multi-select
Substituir o sistema atual de badges + input livre por:
- Multi-select dropdown com as tags da tabela `product_tags`
- Manter opção "Adicionar nova" que cria na tabela automaticamente
- Remover input de texto livre para evitar erros

### 5. Atualizar `KnowledgeAuditTab` e `KnowledgeAudit`
- Substituir input de texto livre do bulk edit por dropdown com tags cadastradas
- Inline edit também usa dropdown em vez de input

### 6. Atualizar `useDistinctProductTags`
- Mudar de RPC `get_distinct_product_tags` para query direta na nova tabela `product_tags`

### Arquivos a criar
- `src/hooks/useProductTags.tsx`
- `src/components/knowledge/ProductTagManager.tsx`

### Arquivos a alterar
- `src/components/KnowledgeArticleDialog.tsx` — dropdown multi-select
- `src/components/KnowledgeAuditTab.tsx` — bulk edit com dropdown
- `src/pages/KnowledgeAudit.tsx` — bulk edit com dropdown
- `src/hooks/useKnowledgeAudit.tsx` — atualizar `useDistinctProductTags`
- Página Knowledge Base — botão para abrir ProductTagManager

