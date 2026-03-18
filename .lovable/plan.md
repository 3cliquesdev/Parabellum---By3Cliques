

# Diagnóstico Conversa #FD7FD039 — Ronildo Oliveira

## O que aconteceu (timeline)

```text
02:40:27  Cliente: "Bom dia" → Master Flow inicia, menu produto
02:40:45  Cliente: "1" → Drop Nacional selecionado
02:40:58  Cliente: "2" → Financeiro selecionado
02:40:59  Motor: Transição → node_ia_financeiro (retorna useAI:true)
         Webhook: Bufferiza mensagem "2" para autopilot (delay ~60s)
02:42:06  Buffer expira → autopilot recebe msg "2" → AI retorna VAZIO
         → fallback "Não consegui resolver por aqui." enviado ao cliente
02:42:29  Cliente: "Boa noite"
02:43:10  Autopilot: Saudação proativa enviada ✅
02:43:11  LLM chamada para "Boa noite" → retorna VAZIO
02:43:18  Retry com prompt reduzido → também VAZIO
02:43:24  Fallback: "Não consegui resolver por aqui." (2ª vez)
```

## 3 Bugs Identificados

### Bug 1: Menu selection "2" é enviada como mensagem do cliente ao nó de IA
**Causa**: Quando o motor transiciona de `ask_options` para `ai_response`, retorna `{ useAI: true, aiNodeActive: true }`. O webhook então bufferiza a mensagem original ("2") e a envia ao autopilot quando o timer expira. O autopilot recebe "2" como customerMessage e não consegue gerar resposta → empty → fallback.

**Fix**: No `process-chat-flow`, quando a transição é de `ask_options` para `ai_response`, incluir uma flag `skipInitialMessage: true` no retorno. No webhook e no `process-buffered-messages`, respeitar essa flag e NÃO enviar a mensagem de seleção ao autopilot.

### Bug 2: LLM retorna VAZIO para "Boa noite" no contexto financeiro
**Causa**: A saudação proativa já foi enviada. Depois, o LLM é chamado para responder "Boa noite" com o prompt financeiro restritivo. O modelo não sabe o que responder a uma saudação genérica em contexto financeiro → retorna vazio → retry vazio → fallback.

**Fix**: No `ai-autopilot-chat`, após enviar saudação proativa, se a mensagem do cliente é uma saudação pura (regex `isGreetingOnly`), **não chamar a LLM** — a saudação proativa já cobre a resposta. Retornar `{ response: greetingMessage, skipped: false }` sem fallback.

### Bug 3: Fallback message "Não consegui resolver por aqui" é inadequada
**Causa**: A fallback_message configurada no nó `node_ia_financeiro` é uma frase que soa como desistência. Isso confunde o cliente e não oferece caminho alternativo.

**Fix**: Não é um bug de código, mas de configuração do fluxo. A fallback_message deveria ser algo como "Pode me contar mais sobre o que precisa?". Porém, os bugs 1 e 2 são a causa raiz — com eles corrigidos, o fallback nunca deveria ter sido acionado nesta conversa.

## Plano de Correção

### 1. `process-chat-flow/index.ts` — Flag para skip de mensagem de menu
Na transição `ask_options → ai_response` (linha ~2916-2919), adicionar `skipInitialMessage: true` no JSON de retorno.

### 2. `meta-whatsapp-webhook/index.ts` — Respeitar skipInitialMessage
No CASO 3 (linha ~1145), quando `flowData.skipInitialMessage === true`:
- NÃO chamar autopilot
- NÃO bufferizar a mensagem
- Apenas fazer `continue` para aguardar a próxima mensagem real do cliente

### 3. `ai-autopilot-chat/index.ts` — Skip LLM após saudação proativa para greetings
Após enviar a saudação proativa, verificar se `customerMessage` é greeting puro. Se sim, retornar a saudação como resposta final sem chamar LLM.

### 4. Deploy
Deploy de `process-chat-flow`, `meta-whatsapp-webhook` e `ai-autopilot-chat`.

