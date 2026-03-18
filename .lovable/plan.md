
# Auditoria V11 — Correções Aplicadas ✅

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
### Bug 8 ✅ — Dígitos de menu pós-greeting causavam loop fallback
### Bug 9 ✅ — Race condition: mensagens IA duplicadas
### Bug 10 ✅ — Persona "Helper Sistema" com role "elper Sistema"
### Bug 11 (MENOR) — KB sem cobertura (recomendação manual)

## Fixes V11 (Deploy realizado)

### Bug 12 ✅ — Cliente aceita transferência e IA ignora
- **Fix:** Detecção PRÉ-LLM de intenção de transferência via regex (CUSTOMER_TRANSFER_INTENT + CUSTOMER_AFFIRM_TRANSFER)
- Quando detectado + contexto de fallback recente → flowExit com handoff imediato sem chamar LLM

### Bug 13 ✅ — Contador anti-loop reseta entre nós
- **Fix:** `ai_total_fallback_count` global no customer_metadata, nunca reseta entre nós
- Threshold: >= 4 fallbacks totais → handoff obrigatório independente do nó

### Bug 14 ✅ — Greeting enviado DEPOIS de fallback
- **Fix:** Verificação de 2+ msgs IA nos últimos 60s antes de enviar greeting
- Se contexto já está ativo, suprime greeting pós-fallback

### Bug 15 ✅ — Build timestamp para rastreabilidade
- **Fix:** `// BUILD: V11 — timestamp` no topo do arquivo

## Deploy
- `ai-autopilot-chat` ✅ re-deployed V11
