

# Migration: Adicionar colunas de memória de longo prazo na tabela `contacts`

## O que será feito

Executar uma migration SQL para adicionar as colunas `ai_summary` e `ai_summary_updated_at` na tabela `contacts`. Todo o código que usa essas colunas já está deployado — esta é a única pendência.

## SQL da Migration

```sql
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.contacts.ai_summary IS 'Resumo gerado por IA das conversas anteriores do cliente';
COMMENT ON COLUMN public.contacts.ai_summary_updated_at IS 'Última atualização do ai_summary';
```

## Resultado

Após a migration, automaticamente:
1. `close-conversation` passa a gerar e salvar resumo ao encerrar conversas
2. `ai-autopilot-chat` injeta o histórico do cliente no prompt
3. Nenhum deploy adicional necessário

