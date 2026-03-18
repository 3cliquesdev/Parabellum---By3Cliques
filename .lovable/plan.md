

# Auditoria IA — Ultima Hora: 5 Bugs Encontrados

## Resumo das Conversas Analisadas (ultima hora)

| Conv ID | Ramo | Problema | Severidade |
|---|---|---|---|
| `780f527f` | Financeiro | skipInitialMessage FALHOU + transfer intent ignorado | CRITICO |
| `54395df4` | Pedidos | Mensagem duplicada: "Vou te transferir" + menu escape | ALTO |
| `abd4deda` | Financeiro | "Encerrar parceria" / "Cancelar" nao detectou intent cancelamento | ALTO |
| `e3a5c7b8` | Comercial | 0 artigos na KB — 100% fallback | MEDIO (KB) |
| `0b3a1c62` | Sistema | "Plano Creation" sem artigos na KB — fallback | MEDIO (KB) |
| `2c5e8b85` | Duvidas | "So isso mesmo, obrigada" gerou fallback em vez de encerrar | BAIXO |

---

## Bug 39 — skipInitialMessage AINDA falhando (Conv 780f527f)

**O que aconteceu:** Cliente selecionou "2" (Financeiro) as 17:08:41. AI respondeu "Nao encontrei informacoes" as 17:08:46 em vez da saudacao.

**Causa provavel:** A conversa iniciou as 17:07. O `process-chat-flow` pode ter retornado pelo path antigo (sem o enriquecimento do Bug 38b) se o deploy ainda nao estava ativo nesse instante. OU o path especifico dessa transicao nao esta sendo coberto pelos fixes. Preciso verificar nos logs se `skipInitialMessage=true` foi retornado.

**Fix:** Adicionar log explicito no `meta-whatsapp-webhook` para registrar o valor de `flowData.skipInitialMessage` em TODAS as respostas do flow, para confirmar se o problema e no `process-chat-flow` ou no webhook.

## Bug 40 — Batching quebrando deteccao de transfer intent (Conv 780f527f)

**O que aconteceu:** Cliente enviou "Sim" (17:11:46) e "Gostaria de falar com atendente" (17:12:07). Com batch delay de 8s, as mensagens foram combinadas. A regex `CUSTOMER_AFFIRM_TRANSFER` usa `^...$` (anchored) que nao funciona em texto combinado. A regex `CUSTOMER_TRANSFER_INTENT` usa `\b` que deveria funcionar, mas o texto combinado "Sim\nGostaria de falar com atendente" pode ter falhado.

**Fix:** No `ai-autopilot-chat`, ao receber mensagens batched (multi-linha), testar CADA LINHA individualmente contra as regexes de transfer intent, nao apenas o texto completo.

## Bug 41 — Mensagem duplicada na transferencia (Conv 54395df4)

**O que aconteceu:** AI enviou "Entendido! Vou te transferir agora para um atendente" (17:06:18) E TAMBEM "Nao consegui resolver por aqui. O que prefere fazer?" (17:06:25) — menu escape duplicado.

**Causa:** O `ai-autopilot-chat` detectou transfer intent e retornou `flowExit: true`. Mas o `meta-whatsapp-webhook` apos receber o flowExit, re-invocou o `process-chat-flow` que gerou o menu escape adicional.

**Fix:** No `meta-whatsapp-webhook`, quando `autopilotData.reason === 'customer_transfer_intent'`, garantir que NAO re-invoca `process-chat-flow` e nao envia menu escape.

## Bug 42 — "Cancelar" / "Encerrar parceria" nao detectado no Financeiro (Conv abd4deda)

**O que aconteceu:** Cliente no no financeiro disse "Encerrar parceria" e "Cancelar". A IA deu fallback generico em vez de acionar a rota de escape `cancelamento` que existe no fluxo V5.

**Causa:** O `ai-autopilot-chat` tem deteccao pre-LLM para `CUSTOMER_TRANSFER_INTENT` mas NAO tem deteccao pre-LLM para intent de `cancelamento`. A deteccao de cancelamento depende da LLM responder com `[[FLOW_EXIT:cancelamento]]`, mas como o RAG nao encontrou artigos (score 0), a IA deu fallback antes de chegar na logica de exit.

**Fix:** Adicionar regex pre-LLM para detectar intent de cancelamento (`cancelar|encerrar parceria|desativar|cancelamento`) quando o no atual tem `forbid_cancellation: true` (indicando que existe rota de escape). Disparar `[[FLOW_EXIT:cancelamento]]` automaticamente.

## Bugs 43/44 — Gaps na Knowledge Base (Convs e3a5c7b8, 0b3a1c62)

**O que aconteceu:** 
- Comercial: "Como funciona?" sobre o produto → 0 artigos encontrados
- Sistema: "Plano Creation" → 0 artigos encontrados

**Causa:** Falta de artigos na KB para estes topicos. Nao e bug de codigo.

**Recomendacao:** Criar artigos na base de conhecimento para:
- Explicacao comercial do produto (o que e drop nacional/internacional, como funciona)
- Planos e prazos de entrega (Creation, etc.)

---

## Plano de Correcao (3 fixes de codigo)

### Fix 1: Deteccao de transfer intent em mensagens batched
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts` ~L7558
- Antes de testar as regexes no `customerMsgTrimmed` completo, split por `\n` e testar cada linha individualmente

### Fix 2: Prevenir menu escape duplicado apos transfer intent
**Arquivo:** `supabase/functions/meta-whatsapp-webhook/index.ts` ~L1880
- Verificar se o handler de `customer_transfer_intent` ja faz `continue` corretamente e nao permite re-processamento

### Fix 3: Deteccao pre-LLM de intent de cancelamento
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts` ~L7556
- Adicionar regex `CUSTOMER_CANCEL_INTENT` para capturar "cancelar", "encerrar parceria", "desativar", "cancelamento"
- Quando detectado em no com `forbidCancellation: true`, retornar `flowExit: cancelamento` automaticamente

### Deploy
- Redeploy `ai-autopilot-chat` e `meta-whatsapp-webhook`

