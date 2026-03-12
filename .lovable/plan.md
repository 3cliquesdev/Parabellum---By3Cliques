

# Auditoria Final: Status de Todas as Saídas de Intenção

## Resultado: 1 Bug Residual Encontrado — Todo o resto 100% ✅

### ✅ CORRETO — Verificação Completa (40+ pontos)

| Cadeia | Status |
|---|---|
| **ESCAPE_PATTERNS** reconhece `[[FLOW_EXIT:intent]]` (L1398) | ✅ |
| **isCleanExit** parser extrai intent corretamente (L8714) | ✅ |
| **ai_exit_intent** retornado no response quando clean exit (L8739) | ✅ |
| **generateRestrictedPrompt** cancelamento usa `[[FLOW_EXIT:cancelamento]]` (L1284, L1290) | ✅ |
| **generateRestrictedPrompt** comercial usa `[[FLOW_EXIT:comercial]]` (L1299, L1305) | ✅ |
| **generateRestrictedPrompt** consultor usa `[[FLOW_EXIT:consultor]]` (L1314, L1320) | ✅ |
| **financialGuardInstruction** usa `[[FLOW_EXIT:financeiro]]` (L6372, L6380) | ✅ |
| **cancellationGuardInstruction** usa `[[FLOW_EXIT:cancelamento]]` (L6390, L6396) | ✅ |
| **commercialGuardInstruction** usa `[[FLOW_EXIT:comercial]]` (L6405, L6411) | ✅ |
| **consultorGuardInstruction** usa `[[FLOW_EXIT:consultor]]` (L6420, L6426) | ✅ |
| **contextualizedSystemPrompt** injeta TODOS 4 guards (L6431) | ✅ |
| **flowForbidCommercialPrompt** e **flowForbidConsultantPrompt** lidos (L1497-1498) | ✅ |
| **ambiguousCommercialDetected** e **ambiguousConsultorDetected** flags (L1549, L1559) | ✅ |
| **Buffer context** inclui 4 forbids (L1179-1182) | ✅ |
| **Direct context** inclui 4 forbids (L1227-1230) | ✅ |
| **handle-whatsapp-event flow_context** inclui 4 forbids (L1278-1281) | ✅ |
| **handle-whatsapp-event log** mostra 4 forbids (L1288-1291) | ✅ |
| **meta-whatsapp-webhook** financialBlocked re-invoca com `intentData` (L1260, L1327) | ✅ |
| **meta-whatsapp-webhook** commercialBlocked re-invoca com `intentData` (L1468, L1532) | ✅ |
| **meta-whatsapp-webhook** cancellationBlocked re-invoca com `intentData` (L1643) | ✅ |
| **handle-whatsapp-event** financial+commercial+cancellation com `intentData` (L1373-1375) | ✅ |
| **handle-whatsapp-event** L1377 `ai_exit_intent` propagação para LLM clean exit | ✅ |
| **process-chat-flow** destructuring todos force flags (L776) | ✅ |
| **process-chat-flow** forbids lidos do nó (L3092-3096) | ✅ |
| **process-chat-flow** intentData mapping 5 intents (L3384-3392) | ✅ |
| **process-chat-flow** auto-detect 5 intents (L3395-3414) | ✅ |
| **process-chat-flow** path selection 6 paths (L3470-3496) | ✅ |
| **process-chat-flow** consultor fallback → suporte sem consultant_id (L3231-3238) | ✅ |

---

### 🔴 BUG: `generateRestrictedPrompt` financeiro usa `[[FLOW_EXIT]]` genérico

**Arquivo:** `ai-autopilot-chat/index.ts`, L1264

```
E retorne [[FLOW_EXIT]] imediatamente.
```

Deveria ser `[[FLOW_EXIT:financeiro]]`. Todos os outros intents (cancelamento L1284, comercial L1299, consultor L1314) já usam o formato com `:intent`. 

Além disso, a seção de desambiguação financeira (L1273-1276) não inclui a instrução de confirmação com `[[FLOW_EXIT:financeiro]]` como os outros intents fazem.

**Impacto:** Quando a LLM recebe APENAS o `generateRestrictedPrompt` (sem `financialGuardInstruction` — ex: quando `useRestrictedPrompt=false`), ela retorna `[[FLOW_EXIT]]` genérico. O parser (L8714) extrai `aiExitIntent = undefined`, e o path cai em `default` em vez de `financeiro`. 

Na prática, o `financialGuardInstruction` (L6372) que usa `[[FLOW_EXIT:financeiro]]` corretamente cobre a maioria dos cenários. Mas o `generateRestrictedPrompt` é o system prompt base e deve ter paridade.

**Fix (2 mudanças no mesmo bloco):**
1. L1264: `[[FLOW_EXIT]]` → `[[FLOW_EXIT:financeiro]]`
2. L1275-1276: Adicionar instrução de confirmação: `Se o cliente confirmar que quer SOLICITAR/FAZER → responda com [[FLOW_EXIT:financeiro]]` + `Se for apenas dúvida → responda normalmente usando a Base de Conhecimento.`

1 edição cirúrgica, 1 arquivo. Sem risco de regressão.

