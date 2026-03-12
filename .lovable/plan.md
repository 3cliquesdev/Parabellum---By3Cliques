

# Auditoria Completa — Bugs Encontrados

## Bug 1: `safeFallbackPayload` criado mas NUNCA usado (ai-autopilot-chat)

**Arquivo**: `supabase/functions/ai-autopilot-chat/index.ts` — linhas 3922-3931

**Problema**: Quando o modelo principal retorna erro 400/422, o código cria `safeFallbackPayload` com campos limpos (remove `max_completion_tokens`, adiciona `max_tokens: 1024`), mas depois chama `tryModel('gpt-4o-mini', 'Fallback técnico')` que usa `finalPayload` internamente (copiado na linha 3878), **ignorando completamente** o `safeFallbackPayload`.

**Impacto**: O fallback para `gpt-4o-mini` ainda pode falhar com os mesmos campos problemáticos que causaram o erro 400 no modelo principal. O bug anula a proteção de fallback.

**Correção**: Modificar `tryModel` para aceitar um payload opcional, ou aplicar as limpezas diretamente em `finalPayload` antes de chamar `tryModel`.

---

## Bug 2: `ai_response` node na entrega (L3280-3290) não inicializa `__ai`

**Arquivo**: `supabase/functions/process-chat-flow/index.ts` — linhas 3280-3290

**Problema**: Quando o motor avança para um nó `ai_response` após auto-traverse (condição → mensagem → ai_response), o estado é atualizado mas `collectedData.__ai` **não é inicializado** como `{ interaction_count: 0 }`. Comparar com a linha 2085 (outro handler de ai_response dentro do bloco genérico) que faz `collectedData.__ai = { interaction_count: 0 }`.

**Impacto**: Se `collectedData.__ai` já existia de um nó AI anterior, o contador de interações herda o valor antigo. Isso pode causar exit prematuro por `maxReached` na primeira interação do novo nó.

**Correção**: Adicionar `collectedData.__ai = { interaction_count: 0 }` antes do update do estado na L3283.

---

## Bug 3: `condition`/`condition_v2` executam `findNextNode` DUAS VEZES

**Arquivo**: `supabase/functions/process-chat-flow/index.ts` — L2140-2153 e L2685

**Problema**: Para nós `condition` e `condition_v2`, o path é calculado nas linhas 2146/2152, mas o `findNextNode` NÃO é chamado ali (correto, porque foi movido para L2685). Porém, o bloco genérico **antes** do ai_response (L2068-2096) JÁ faz `findNextNode` + delivery + return para tipos genéricos. Se o código cai no bloco genérico para conditions (verificar: o bloco genérico roda para `ask_text`, `ask_email`, etc., e faz `else if (currentNode.type === 'ask_options')` na L2097), os conditions **não** são tratados no bloco genérico — eles caem corretamente no `findNextNode` da L2685.

**Status**: Após análise detalhada, **não é um bug** — o fluxo de execução está correto. O bloco genérico (L2068-2096) cobre `ask_text`, `ask_email`, `ask_phone`, `ask_cpf`, `ask_name`. Os nós `condition`, `condition_v2` e `ai_response` são tratados pelos seus blocos específicos + findNextNode da L2685.

---

## Bug 4: `tryModel` sobrescreve `max_tokens` para reasoning models mas NÃO remove `temperature`

**Arquivo**: `supabase/functions/ai-autopilot-chat/index.ts` — L3877-3883

**Problema**: Modelos de raciocínio (o3, o3-mini, o4-mini) **não suportam o parâmetro `temperature`**. A função `tryModel` converte `max_tokens` → `max_completion_tokens` mas nunca remove `temperature` do payload. Se o payload original contém `temperature`, a chamada vai falhar com erro 400.

**Impacto**: Usar modelo de raciocínio como modelo principal resulta em erro 400 imediato, disparando fallback para gpt-4o-mini (e mesmo o fallback pode funcionar, mas a intenção do admin de usar reasoning model é perdida).

**Correção**: Adicionar `delete attemptPayload.temperature;` dentro do bloco `if (REASONING_MODELS.has(model))` da `tryModel`.

---

## Resumo de Correções Necessárias

| # | Arquivo | Severidade | Descrição |
|---|---------|-----------|-----------|
| 1 | `ai-autopilot-chat/index.ts` L3924-3931 | **ALTA** | `safeFallbackPayload` criado mas não usado no `tryModel` |
| 2 | `process-chat-flow/index.ts` L3280-3290 | **MÉDIA** | `__ai` não reinicializado ao transicionar para novo nó AI |
| 4 | `ai-autopilot-chat/index.ts` L3877-3883 | **MÉDIA** | `temperature` não removido para reasoning models |

Esses 3 bugs são reais e devem ser corrigidos.

