

## Problema Identificado

A edge function `analyze-ticket` tem o modelo **hardcoded** como `gpt-5-mini` (linha 10) e **nunca lê** a configuração `ai_default_model` do banco. Diferente do `ai-autopilot-chat` e `sandbox-chat` que consultam `system_configurations`, o `analyze-ticket` ignora completamente essa config.

Isso significa que mesmo que voce mude o modelo no painel, o sentiment continua usando `gpt-5-mini`.

## Plano

### 1. Atualizar `analyze-ticket` para ler modelo do banco

Adicionar leitura da `system_configurations.ai_default_model` com fallback para `gpt-5-nano` (modelo mais barato, ideal para sentiment que e tarefa simples).

### 2. Permitir override por modo

Criar uma config separada `ai_sentiment_model` opcional que, se existir, sobrescreve o modelo global apenas para sentiment. Isso permite usar `gpt-5-nano` para sentiment enquanto mantém `gpt-5-mini` para outras features.

### 3. Sanitizar nomes de modelo (mesmo padrão do autopilot)

Reaproveitar o mapa de `gateway name -> OpenAI name` para garantir compatibilidade.

### Detalhes Tecnico

**Arquivo:** `supabase/functions/analyze-ticket/index.ts`

- Criar função `getConfiguredModel(supabase, mode)` que:
  1. Busca `ai_sentiment_model` e `ai_default_model` do `system_configurations`
  2. Para `mode === 'sentiment'`: usa `ai_sentiment_model` se existir, senao `ai_default_model`, senao `gpt-5-nano`
  3. Para outros modos: usa `ai_default_model`, senao `gpt-5-mini`
  4. Sanitiza nomes gateway (ex: `openai/gpt-5-nano` -> `gpt-5-nano`)

- Criar o client Supabase no handler (ja tem `OPENAI_API_KEY`, basta adicionar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`)

**Impacto estimado:** Sentiment passando de `gpt-5-mini` para `gpt-5-nano` reduz custo por chamada em ~60-70%, e combinado com o cache de sentiment (futuro) elimina ~95% do gasto atual.

