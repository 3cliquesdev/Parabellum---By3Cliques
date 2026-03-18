
# Auditoria V8 Comportamental — Correções Aplicadas ✅

## Bugs Corrigidos

### Bug 1 (CRÍTICO) ✅ — Fallback self-blocking loop
- **Fix:** Guard `!isSystemGeneratedMessage` no escape check (L9534)
- **Fix:** Frase do fallback reescrita sem "Posso transferir" (L7551)

### Bug 2 (CRÍTICO) ✅ — Greeting double-send
- **Fix:** `isProactiveGreeting` incluído no guard `isSystemGeneratedMessage`

### Bug 3 (MODERADO) ✅ — {{conversation_queue}} vazando
- **Fix:** `replaceVariables()` agora remove variáveis não resolvidas

### Bug 4 (MODERADO) ✅ — Detecção financeira ampla
- **Fix:** Removidos 'pagamento', 'dinheiro', 'transferência', 'cancelar', 'cancelamento' do `FINANCIAL_BARRIER_KEYWORDS`

### Bug 5 (MODERADO) ✅ — KB retornando artigos irrelevantes
- **Fix:** Threshold aumentado de 0.40→0.55 (default) e 0.50→0.55 (RPC)
- **Fix:** Artigos `sandbox_training` excluídos da busca semântica principal

### Bug 6 (MENOR) ✅ — Typo persona
- **Fix:** Migration corrigiu "Assisntente" → "Assistente"

## Deploy
- `ai-autopilot-chat` ✅
- `process-chat-flow` ✅
