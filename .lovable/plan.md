

# Fix: Template do IA Response não enviado após verificação de identidade

## Diagnóstico

Na conversa `#5F0529BA`, o fluxo foi:
1. Cliente escolheu "Financeiro" → `node_ia_financeiro`
2. OTP já verificado anteriormente (06:00)
3. Cliente disse "Quero sacar" → guard pós-OTP detectou `hasSaqueIntent: true`
4. `interaction_count = 0` → caiu no branch `isFirstInteraction` (L6361) que **NÃO FAZ NADA**
5. Nenhum `_otpJustValidated` foi setado → `identityWallNote` ficou vazio → template nunca foi enviado
6. IA enviou mensagem genérica `"✅ Identidade verificada com sucesso..."`
7. Cliente respondeu "Muito obrigado" → `fallback_phrase_detected` → bloqueador repetiu a mensagem genérica

**Causa raiz:** A governança de `interaction_count` bloqueia o envio do template na primeira interação, mesmo quando `description_template` está configurado no nó. O template deveria ser soberano e enviado imediatamente.

## Correção

### `supabase/functions/ai-autopilot-chat/index.ts`

**Local 1 — Guard pós-OTP (L6341-6367):**
Quando `description_template` existe no nó atual, **ignorar a checagem de `isFirstInteraction`** e setar `_otpJustValidated = true` imediatamente. O template É a apresentação proativa — não faz sentido esperar a IA se apresentar antes.

```
Antes (L6355-6366):
if (!recentCollectionMsg && !isFirstInteraction) {
  // seta _otpJustValidated → identityWallNote ativa
} else if (isFirstInteraction) {
  // NÃO FAZ NADA — bug
}

Depois:
const hasDescTemplateGuard = !!(flow_context as any)?.ticketConfig?.description_template;

if (!recentCollectionMsg && (hasDescTemplateGuard || !isFirstInteraction)) {
  // Se tem template, SEMPRE ativa (template é proativo)
  // Se não tem template, respeita interaction_count
  (conversation as any)._otpJustValidated = true;
} else if (isFirstInteraction && !hasDescTemplateGuard) {
  // Só deixa IA se apresentar se NÃO tem template
}
```

**Local 2 — Fallback blocker (L9933-9940):**
Quando o fallback blocker é ativado e `hasDescTemplateFbBlocker` é true, ele já usa `buildCollectionMessage` (correto). Mas a mensagem genérica "Vou dar continuidade" pode ter sido enviada antes — verificar se o template já foi enviado para evitar duplicata.

**Local 3 — identityWallNote (L6924-6946):**
Já funciona corretamente quando `_otpJustValidated` é true. O fix no Local 1 resolve o problema.

### Deploy
- `ai-autopilot-chat`

## Resumo
Uma única mudança no guard pós-OTP (L6355): quando `description_template` existe, sempre setar `_otpJustValidated` independente do `interaction_count`. Isso faz o template ser enviado proativamente na primeira interação, como esperado.

