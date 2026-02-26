

# Diagnóstico: A KB está alimentando a IA instantaneamente?

## Status Atual

| Aspecto | Status | Detalhe |
|---|---|---|
| Artigos publicados | 48 | OK |
| Com embedding | 47/48 | **1 artigo sem embedding** ("Cancelamento de Assinatura Kiwify") |
| Trigger automático de embedding | **NÃO EXISTE** | Embeddings só são gerados manualmente (botão "Gerar Embeddings" ou ao salvar artigo via UI) |
| Busca semântica no autopilot | ✅ Funciona | `match_knowledge_articles` com threshold 0.50 |
| Busca keyword fallback | ✅ Funciona | Fallback quando embedding falha |

## Problemas Encontrados

### 1. Sem trigger automático de embedding
Quando um artigo é criado/editado **fora da UI** (ex: via `train-ai-pair`, importação de spreadsheet, `extract-knowledge-from-chat`), o embedding **NÃO é gerado automaticamente**. Só é gerado quando:
- O usuário salva pelo dialog `KnowledgeArticleDialog` (linha 103-106)
- O usuário clica "Gerar Embeddings" manualmente
- O candidato é aprovado via `useApproveCandidate`

### 2. 1 artigo publicado sem embedding
"Cancelamento de Assinatura Kiwify" está publicado mas **invisível para a busca semântica**.

## Plano de Correção

### 1. Criar trigger no banco para gerar embedding automaticamente
Usar `pg_net` para chamar a edge function `generate-article-embedding` automaticamente sempre que um artigo for inserido ou atualizado com `is_published = true`.

```sql
CREATE OR REPLACE FUNCTION public.trigger_generate_embedding()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_published = true AND (
    OLD IS NULL OR 
    OLD.content IS DISTINCT FROM NEW.content OR 
    OLD.is_published IS DISTINCT FROM NEW.is_published
  ) THEN
    PERFORM net.http_post(
      url := '<supabase_url>/functions/v1/generate-article-embedding',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
      body := json_build_object('article_id', NEW.id, 'content', NEW.content)::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_article_publish
  AFTER INSERT OR UPDATE ON knowledge_articles
  FOR EACH ROW EXECUTE FUNCTION trigger_generate_embedding();
```

### 2. Gerar embedding do artigo faltante
Executar embedding para o artigo "Cancelamento de Assinatura Kiwify" que está sem.

## Resultado Esperado
- Qualquer artigo publicado (via UI, train-ai-pair, import, passive learning) terá embedding gerado **automaticamente em segundos**
- A IA sempre terá acesso semântico ao conteúdo mais recente
- Zero intervenção manual necessária

