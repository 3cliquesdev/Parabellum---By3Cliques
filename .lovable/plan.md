
# Auditoria V12 — Correções Aplicadas ✅

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

## Fixes V12 (Deploy realizado)

### Bug 16 ✅ — Regex de transferência incompleta
- **Fix:** Expandido `CUSTOMER_TRANSFER_INTENT` para cobrir conjugações reais:
  - `me\s+transfer[ea]` (transfere + transfera)
  - `me\s+conect[ae]` (conecta + conecte)
  - `equipe\s+de\s+suporte`
  - `atendimento\s+humano`
  - `falar\s+com\s+(suporte|equipe)`

### Bug 17 ✅ — Afirmativo "Sim" com pontuação não detectado
- **Fix:** Expandido `CUSTOMER_AFFIRM_TRANSFER` com variantes de pontuação:
  - `sim[,.]?\s*quero`
  - `sim[,.]?\s*por\s+favor`
  - `sim[,.]?\s*pode`
  - `sim[,.]?\s*pode\s+ser`

### Bug 18 ✅ — Deploy forçado para ativar V8-V12
- **Fix:** Re-deploy da edge function `ai-autopilot-chat` com BUILD V12 timestamp

## Deploy
- `ai-autopilot-chat` ✅ re-deployed V12
