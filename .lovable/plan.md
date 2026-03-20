
# Fix: Template de coleta PIX não enviado após OTP verificado — Conversa #8F42B1C3

## Diagnóstico

**Sintoma:** Após OTP verificado no fluxo financeiro, a IA envia mensagem genérica "✅ Identidade verificada com sucesso..." em vez do template de coleta PIX.

**Log decisivo:**
```
POST-OTP SAQUE — primeira interação sem template { aiInteractions: 0, hasSaqueIntent: true }
```

**Causa raiz DUPLA:**

### Bug 1 — Webhook Buffer Incompleto (PRINCIPAL)
O `meta-whatsapp-webhook` ao usar batching (L1273-1293) salva `flowData` no `message_buffer` **SEM** as propriedades:
- `ticketConfig` ← contém `description_template`
- `otpVerified`
- `smartCollectionEnabled` / `smartCollectionFields`
- `forbidSupport` / `returnReasons` / `collectedData` / `closeTagId` / `stateId`

Quando `process-buffered-messages` reconstrói o `flow_context` a partir desse `flowData` incompleto, o `ticketConfig` chega como `null` → `hasDescTemplateGuard = false`.

### Bug 2 — Guard pós-OTP excessivamente restritivo
Mesmo que o `ticketConfig` estivesse correto, o guard em L6359 exigia `hasDescTemplateGuard || !isFirstInteraction`. Na primeira interação (`aiInteractions=0`), sem template, o sistema "deixava a IA se apresentar" — gerando resposta genérica → `fallback_phrase_detected` → loop.

## Correções Aplicadas

### 1. `meta-whatsapp-webhook/index.ts` — Buffer completo
Adicionadas 11 propriedades faltantes no `flowData` salvo no buffer:
`stateId`, `personaName`, `forbidSupport`, `returnReasons`, `ticketConfig`, `closeTagId`, `otpVerified`, `collectedData`, `smartCollectionEnabled`, `smartCollectionFields`.

### 2. `ai-autopilot-chat/index.ts` — Fallback defensivo + guard relaxado
- **Fallback defensivo:** Se `ticketConfig` está ausente mas `stateId` existe, reconstrói `ticketConfig` do `flow_definition` do nó atual no banco.
- **Guard relaxado:** `hasSaqueIntent` agora é condição suficiente para ativar `_otpJustValidated`, mesmo na primeira interação.
- **Logs estruturados:** Novo log `POST-OTP CONTEXT` com `post_otp_response_mode: template | smart_fields | generic`.

### 3. Deploy
- `meta-whatsapp-webhook`
- `ai-autopilot-chat`

## Impacto
Corrige o bug para TODAS as conversas que passam pelo batching (que é o caminho padrão). O fallback defensivo adiciona resiliência mesmo se outros pontos de propagação falharem no futuro.
