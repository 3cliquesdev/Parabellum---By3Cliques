

# Fix: "Sem embedding" persiste mesmo após gerar embedding

## Diagnóstico

O artigo "Como funciona o saque do dinheiro?" tem `embedding_generated = false` no banco, mesmo que o embedding tenha sido gerado. A causa raiz:

A função `update_article_embedding` no banco **só atualiza a coluna `embedding`**, mas **NÃO marca `embedding_generated = true`**:

```sql
-- Função atual (BUG):
UPDATE public.knowledge_articles
SET embedding = new_embedding
WHERE id = article_id;
-- Falta: embedding_generated = true
```

## Solução

Uma migration para corrigir a função:

```sql
CREATE OR REPLACE FUNCTION public.update_article_embedding(article_id uuid, new_embedding vector)
RETURNS void
LANGUAGE sql
SET search_path TO 'public'
AS $$
  UPDATE public.knowledge_articles
  SET embedding = new_embedding,
      embedding_generated = true
  WHERE id = article_id;
$$;
```

Depois, corrigir os artigos que ja tem embedding mas `embedding_generated = false`:

```sql
UPDATE public.knowledge_articles
SET embedding_generated = true
WHERE embedding IS NOT NULL AND (embedding_generated IS NULL OR embedding_generated = false);
```

## Sobre o ticket do Luiz

A migration de RLS para consultores **foi aplicada com sucesso** (verificado diretamente no banco). Se Luiz ainda não consegue atribuir, peça que ele faça logout e login novamente, ou me envie o erro exato que aparece.

