

# Auditoria V13: Bugs Residuais Pós-V12

## Estado do Deploy V12

**V12 ESTÁ ativo em produção.** Evidências confirmadas:
- `contract_violation_blocked` parou às 13:03 (32 eventos, todos OLD code) — V8+ ativo
- `skipLLMForGreeting=true` nos logs (13:56:04) — V10 Bug 7 ativo
- `customer_transfer_intent_detected` apareceu 1x (conv `3d4e4509`, 13:55:17) — V12 Bug 12 ativo

## Métricas Últimas 2 Horas

| Métrica | Valor |
|---|---|
| ai_response | 106 |
| contract_violation_blocked (parou 13:03, OLD code) | 33 |
| ai_transfer | 33 |
| zero_confidence_cautious | 19 |
| fallback_phrase_detected | 16 |
| anti_loop_max_fallbacks | 5 |
| customer_transfer_intent_detected | 1 |

---

## BUG 20 (CRITICO): flowExit de Transfer Intent Re-Invoca Flow → Mensagens Duplicadas

**Evidência direta (conv `3d4e4509`):**
```
13:55:17 — IA: "Entendido! Vou te transferir agora..." ← V12 transfer intent ✅
13:55:22 — IA: "Não consegui resolver por aqui." ← flow engine re-invocado ❌
13:55:25 — IA: "O que prefere fazer? 1. Voltar 2. Falar com atendente" ← menu ❌
13:55:42 — Cliente: "Falar com um atendente"
13:55:45 — Bot: "Desculpe, não entendi..." ← flow retry ❌
13:55:55 — Cliente: "2"
13:55:59 — Bot: "Transferindo para um atendente..." ← finalmente transfere
```

**Causa raiz:** Quando `ai-autopilot-chat` retorna `{ flowExit: true, reason: 'customer_transfer_intent' }`, o webhook em L1875 trata TODOS os flowExits da mesma forma — re-invoca `process-chat-flow` com `forceAIExit: true`. O flow engine avança para o próximo nó, que envia "Não consegui resolver" + menu de opções, **sobrepondo** a transferência que já foi detectada e a mensagem que já foi enviada.

Resultado: O cliente recebe 4-5 mensagens extras e precisa navegar um menu para algo que já foi confirmado.

**Fix:** No webhook (L1875), antes de re-invocar `process-chat-flow`, verificar se `autopilotData.reason === 'customer_transfer_intent'` ou `autopilotData.reason === 'global_anti_loop_handoff'`. Se sim, **pular** o flow re-invocation e executar o handoff direto (transição para `waiting_human` + dispatch). Aplicar paridade no `handle-whatsapp-event` (L1414).

---

## BUG 21 (CRITICO): Handoff Não Executa Após Transfer Intent

**Evidência:** Conv `3d4e4509` recebeu a mensagem "Vou te transferir agora" mas o `ai_mode` NÃO mudou para `waiting_human` naquele momento — o fluxo continuou ativo. O handoff só ocorreu 42 segundos depois, quando o cliente navegou o menu manualmente e selecionou "2 - Falar com atendente".

**Causa raiz:** O `ai-autopilot-chat` envia a mensagem de transferência e retorna `flowExit: true`, mas NÃO executa a transição de estado da conversa (não chama `transition-conversation-state`). O webhook re-invoca o flow engine que pode ou não fazer transfer. A transferência fica dependente do flow engine processar o `forceAIExit` corretamente.

**Fix:** No bloco de transfer intent detection (L7562-7593 do `ai-autopilot-chat`), após enviar a mensagem, executar a transição de estado diretamente: `ai_mode = 'waiting_human'`, `handoff_executed_at = now()`. Alternativamente, adicionar um campo `immediateHandoff: true` no response e fazer o webhook executar o handoff diretamente sem re-invocar o flow engine.

---

## BUG 22 (MODERADO): Global Anti-Loop Counter Nunca Incrementa

**Evidência:** `ai_total_fallback_count = 0` em TODAS as conversas, incluindo `a48f1943` (7 fallbacks) e `f6490f7e` (6 fallbacks).

**Análise:** Os fallbacks dessas conversas ocorreram entre 13:31-13:48, antes do deploy V12. Porém, NENHUMA conversa pós-V12 mostra `ai_total_fallback_count > 0`, o que pode indicar que o código do contador (L9326-9338) não está sendo alcançado.

**Investigação necessária:** Verificar se o bloco de código em L9315-9365 é alcançado — pode estar dentro de um `if (flow_context)` que não executa em certos cenários, ou o `isFallbackResponse` pode não estar setado corretamente quando o fallback é gerado pela frase "Não encontrei informações".

**Fix:** Adicionar log de telemetria no bloco L9326 para confirmar execução: `console.log('[ai-autopilot-chat] 🔢 Global counter:', { current, new, isFallback })`. Se o bloco não executa, mover a lógica do contador para antes do return do fallback response.

---

## BUG 23 (MENOR): "Sim" Sozinho com Contexto de Fallback Recente Deveria Transferir

**Evidência (conv `a48f1943`):**
```
13:38:04 — IA: "Quer que eu te conecte com a equipe de suporte?"
13:38:23 — Cliente: "Sim"
13:39:26 — IA: "Não consegui resolver por aqui." ← deveria ter transferido
```

**Análise:** "Sim" casa com o regex `CUSTOMER_AFFIRM_TRANSFER`. Com fallback recente, `hasFallbackContext` seria true. Deveria ter funcionado — mas não funcionou porque V12 não estava deployado neste momento.

**Status:** Corrigido pelo V12 deploy, mas precisa validação em produção.

---

## Plano de Correções

### 1. Bug 20+21 — Handoff imediato no transfer intent (Prioridade máxima)

**No `meta-whatsapp-webhook` (L1875):** Adicionar guard:
```typescript
if (autopilotData?.reason === 'customer_transfer_intent' || 
    autopilotData?.reason === 'global_anti_loop_handoff') {
  // Pular flow re-invocation — executar handoff direto
  await supabase.from('conversations').update({
    ai_mode: 'waiting_human',
    handoff_executed_at: new Date().toISOString(),
    department: autopilotData.flow_context?.department || DEPT_SUPORTE_FALLBACK,
  }).eq('id', conversation.id);
  // Dispatch job
  await supabase.functions.invoke('route-conversation', { ... });
  continue; // Pular o bloco de flowExit re-invocation
}
```

**No `handle-whatsapp-event` (L1414):** Aplicar o mesmo guard para paridade.

### 2. Bug 22 — Diagnóstico + fix do global counter

Adicionar logs de telemetria no bloco L9326 e verificar se `isFallbackResponse` está sendo setado quando a resposta contém "Não encontrei informações". Se o bloco não está sendo alcançado, mover a lógica de incremento para o ponto onde o fallback é efetivamente gerado.

### 3. Validação pós-deploy

Monitorar:
- `customer_transfer_intent_detected` → conv deve transitar para `waiting_human` em < 5s
- `ai_total_fallback_count` > 0 em conversas com fallbacks
- Zero mensagens de menu ("O que prefere fazer?") após transfer intent

