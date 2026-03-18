
# Auditoria V13 — Correções Aplicadas ✅

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
### Bug 13 ✅ — Contador anti-loop reseta entre nós
### Bug 14 ✅ — Greeting enviado DEPOIS de fallback
### Bug 15 ✅ — Build timestamp para rastreabilidade

## Fixes V12 (Deploy realizado)

### Bug 16 ✅ — Regex de transferência incompleta
### Bug 17 ✅ — Afirmativo "Sim" com pontuação não detectado
### Bug 18 ✅ — Deploy forçado para ativar V8-V12

## Fixes V13 (Deploy realizado)

### Bug 20+21 ✅ — flowExit de Transfer Intent re-invoca flow → mensagens duplicadas + handoff não executa
- **Fix:** Guard PRÉ-flowExit nos dois webhooks (`meta-whatsapp-webhook` e `handle-whatsapp-event`)
- Quando `reason === 'customer_transfer_intent'` ou `reason === 'global_anti_loop_handoff'`:
  - **Pula** re-invocação do `process-chat-flow` (elimina mensagens duplicadas)
  - Executa handoff **direto**: `ai_mode = 'waiting_human'`, `assigned_to = null`
  - Chama `route-conversation` para dispatch imediato
- Resultado: Cliente recebe apenas "Vou te transferir agora" e é transferido em < 5s

### Bug 22 ✅ — Global anti-loop counter sem diagnóstico
- **Fix:** Telemetria adicionada no bloco L9326 do `ai-autopilot-chat`:
  - Log: `🔢 V13 Bug 22: Global counter — isFallback=X, current=Y, new=Z, nodeId=N`
- Permite monitorar se `isFallbackResponse` está sendo setado e se o counter incrementa

## Deploy
- `ai-autopilot-chat` ✅ re-deployed V13
- `meta-whatsapp-webhook` ✅ re-deployed V13
- `handle-whatsapp-event` ✅ re-deployed V13
