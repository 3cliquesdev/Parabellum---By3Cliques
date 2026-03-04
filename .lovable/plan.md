

# Plan: Normalizar Dados de Sentimento e Corrigir Viés Neutro

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico

**Dados atuais no banco:**
- `neutro`: 947,209 (99.6%) -- massivamente inflado
- `critico`: 2,999
- `promotor`: 459
- `crítico` (com acento): 21 -- duplicata
- `neutra`: 1 -- espúrio
- `crucial`: 1 -- espúrio

**Causa raiz do viés neutro:** Todas as chamadas atuais ao `analyze-ticket` estão retornando `fallback: true, reason: "rate_limit"` com resultado default `"neutro"`. Ou seja, ~99% dos registros de sentimento NÃO são análises reais -- são fallbacks de rate limit sendo gravados como se fossem dados reais.

## Plano (3 partes)

### 1. Migração SQL: Limpar dados existentes + Atualizar RPC

- **UPDATE** `ai_usage_logs` SET `result_data = '{"sentiment":"critico"}'` WHERE sentiment = `'crítico'`
- **DELETE** registros com sentimentos espúrios (`neutra`, `crucial`)
- **UPDATE** a RPC `get_ai_usage_metrics` para normalizar na query (merge `critico`/`crítico`, ignorar valores fora do set válido)
- Adicionar filtro para excluir registros com `result_data->>'fallback' = 'true'` ou onde o sentimento foi gerado por fallback (não é análise real)

### 2. Edge Function `analyze-ticket`: Parar de gravar fallbacks como dados reais

No frontend (`useSentimentAnalysis.tsx`):
- Quando a resposta vier com `fallback: true`, **NAO gravar** no `ai_usage_logs` -- pois não é uma análise real
- Manter o retorno de `"neutro"` como fallback para a UI (badge), mas sem poluir os logs de métricas

### 3. Prompt de sentimento mais calibrado

Atualizar o prompt no `analyze-ticket` para:
- Ser mais assertivo na classificação (menos viés para neutro)
- Dar exemplos concretos de cada categoria
- Instruir que mensagens curtas como "Ok", "1", "Sim" devem ser classificadas pelo contexto geral, não individualmente
- Manter a normalização no `useSentimentAnalysis.tsx` como safety net

## Arquivos modificados

1. **Nova migração SQL** -- limpeza de dados + upgrade da RPC
2. **`src/hooks/useSentimentAnalysis.tsx`** -- não gravar fallbacks no log
3. **`supabase/functions/analyze-ticket/index.ts`** -- prompt de sentimento melhorado

## Impacto

- Zero regressão: widget de sentimento continua funcionando, agora com dados limpos
- Dashboard passa a mostrar distribuição real (sem inflação de neutros por rate limit)
- Dados futuros ficam precisos (só análises reais são gravadas)

