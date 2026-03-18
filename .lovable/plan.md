

# Auditoria do Sistema — Estado Atual dos Deploys

## Resumo dos Logs Analisados

O sistema está **parcialmente corrigido**. Os fixes de saudação e skipLLMForGreeting estão funcionando, mas o **Bug 1 (skipInitialMessage) está incompleto** — só cobre 1 dos 7+ caminhos que transitam para nós de IA.

---

## O que Está Funcionando (✅)

1. **skipLLMForGreeting** — Quando a mensagem "1" (dígito de menu) chega ao autopilot, o sistema detecta corretamente como "greeting/menu noise" e pula a chamada LLM. Log confirmado:
   - `✅ Saudação proativa cobre a resposta — skip LLM para greeting/menu noise: 1`
   - `⏭️ skipLLMForGreeting=true — retornando sucesso sem chamar LLM`

2. **Saudação proativa** — Enviada corretamente via WhatsApp Meta sem duplicidade de nome.

3. **Zero confidence cautious** — Quando score=0 e flow_context ativo, permanece no nó em vez de fazer handoff prematuro.

---

## Bug Pendente: skipInitialMessage Incompleto (⚠️)

O `skipInitialMessage: true` foi adicionado em **apenas 1 caminho** (linha 2921 — transição genérica ask_options → ai_response). Porém, existem **pelo menos 6 outros caminhos** que transitam para nós de IA sem essa flag:

| Linha | Contexto | skipInitialMessage |
|-------|----------|--------------------|
| 2921 | ask_options genérico → ai_response | ✅ Presente |
| 4548 | intent-routing (condition_v2 → ai_response) | ❌ Ausente |
| 5443 | Master Flow start → ai_response | ❌ Ausente |
| 3772 | stayOnNode (re-entry no mesmo nó) | N/A (correto) |
| 2067 | OTP not-customer → ai_response | ❌ Ausente |
| 2295 | OTP verified → ai_response | ❌ Ausente |

**O que aconteceu na conversa auditada**: O cliente selecionou "1" (Pedidos), o motor roteou via **intent-routing** (linha 4548), e NÃO via ask_options genérico (linha 2921). O dígito "1" foi bufferizado e enviado ao autopilot. O `skipLLMForGreeting` salvou a situação, mas o correto seria o dígito nunca ter chegado ao autopilot.

### Impacto Real
- **Baixo agora** — o `skipLLMForGreeting` funciona como rede de segurança
- **Potencial** — gasta uma invocação desnecessária do autopilot (6.3s de latência) e uma chamada ao expand-query que falha (400)

---

## Plano de Correção

### 1. Adicionar `skipInitialMessage: true` em todos os caminhos relevantes
Nos retornos de `process-chat-flow/index.ts` onde ocorre transição de menu/condição para `ai_response`:
- **Linha 4548** (intent-routing → ai_response): Adicionar `skipInitialMessage: true`
- **Linha 5443** (Master Flow start → ai_response): Avaliar caso a caso (pode ser legítimo)

### 2. Adicionar verificação no `process-buffered-messages`
Como rede de segurança adicional, verificar `flowData.skipInitialMessage` no CRON mode (linha 145) e filtrar mensagens de menu do concat.

### 3. Deploy
Deploy de `process-chat-flow` e `process-buffered-messages`.

---

## Outros Achados Menores

- **expand-query error 400**: Query "1" é muito curta para expansão. O fallback funciona, mas gera noise nos logs. Poderia ter um guard `if (query.length < 3) skip expansion`.
- **send_financial_otp DESABILITADO**: Correto para nó de Pedidos (sem permissão financeira).
- **Reconnecting UI**: Houve um breve evento de reconexão no frontend (2s), resolvido automaticamente.

