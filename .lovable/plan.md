
# Auditoria V10 — Correções Aplicadas ✅

## Fixes V8 (Produção Confirmada)
| Fix | Status |
|---|---|
| Bug 1: Self-blocking loop | ✅ |
| Bug 2: Greeting double-send | ✅ (causa raiz real corrigida no Bug 7) |
| Bug 3: {{vars}} vazando | ✅ |
| Bug 4: Detecção financeira | ✅ |
| Bug 5: KB sandbox | ✅ |
| Bug 6: Typo persona | ✅ |

## Fixes V10 (Deploy realizado)

### Bug 7 ✅ — isProactiveGreeting não pulava LLM
- **Fix:** `|| isProactiveGreeting` adicionado à condição skipLLMForGreeting (L7443)

### Bug 8 ✅ — Dígitos de menu pós-greeting causavam loop fallback
- **Fix:** Guard independente para `alreadySentGreeting && isMenuNoise` responde contextualizadamente sem LLM

### Bug 9 ✅ — Race condition: mensagens IA duplicadas
- **Fix:** Dedup check 5s antes de inserir greeting — verifica `is_ai_generated=true` nos últimos 5s

### Bug 10 ✅ — Persona "Helper Sistema" com role "elper Sistema"
- **Fix:** UPDATE direto no banco corrigindo role para "Helper Sistema"

### Bug 11 (MENOR) — KB sem cobertura
- Sem correção de código — recomendação de enriquecer base de conhecimento

## Deploy
- `ai-autopilot-chat` ✅ re-deployed
- Persona role ✅ corrigido via UPDATE
