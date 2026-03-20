

## Auditoria Completa — Conversa #8AEAB149

### Diagnóstico dos Logs

**Linha do tempo da conversa:**
1. 23:57 — Cliente escolheu "Financeiro", AI saudou corretamente, OTP verificado, dados coletados
2. 23:59 — Cliente enviou dados com "todo saldo da carteira" → AI FALHOU em criar ticket (código antigo, `withdrawal_amount: number`)
3. 00:00 — "Não consegui resolver" → escape node ativado (BUG ORIGINAL, pré-deploy)
4. 00:18 — Agente reiniciou fluxo manualmente (`__manual_test: true`)
5. 00:20 — Cliente escolheu "2" (Financeiro) → AI recebeu "2" como query ao invés de saudação proativa → KB miss
6. 00:21 — Cliente enviou "2" de novo → zero_confidence → "Vacilo vai tomar no cu" → fallback → escape → "Não consegui resolver" DE NOVO

### Bugs Identificados

**Bug 1 (CORRIGIDO):** `withdrawal_amount: number` → `string`. Já deployado.

**Bug 2 (CORRIGIDO):** `.toFixed(2)` em `createTicketSuccessMessage()` → `formatAmount()`. Já deployado.

**Bug 3 (NÃO CORRIGIDO — CRÍTICO):** Quando batching está ativo, o webhook salva o `flowData` no buffer SEM o campo `skipInitialMessage` (linhas 1230-1249 do `meta-whatsapp-webhook`). Quando o CRON `process-buffered-messages` pega a mensagem, `effFlowData.skipInitialMessage` é `undefined`, e o dígito "2" é enviado à AI como query normal — a saudação proativa nunca dispara.

**Bug 4 (NÃO CORRIGIDO):** O `callPipeline()` do `process-buffered-messages` (linha 371) SEMPRE envia `customerMessage: concatenatedMessage`. Mesmo quando `skipInitialMessage` é detectado no CRON mode (linhas 149-172), o path de DIRECT mode (linha 320-327) não faz nenhuma verificação de `skipInitialMessage`.

### Plano de Correção — 2 edições + deploy

**Edição 1: `meta-whatsapp-webhook/index.ts` — Propagar `skipInitialMessage` no buffer**

Na função `bufferAndSchedule` (linhas 1230-1249), adicionar `skipInitialMessage` ao objeto `flowData` salvo:

```typescript
flowData: {
  useAI: flowData.useAI,
  aiNodeActive: flowData.aiNodeActive,
  skipInitialMessage: (flowData as any).skipInitialMessage || false, // ← ADICIONAR
  flowId: flowData.flowId,
  // ... resto dos campos existentes
}
```

**Edição 2: `process-buffered-messages/index.ts` — CRON mode: ampliar detecção de skipInitialMessage**

No CRON mode (linhas 149-151), o check `isMenuDigit` é muito restritivo. Se `skipInitialMessage=true`, a mensagem SEMPRE deve ser substituída por vazio, independente de ser dígito ou não:

```typescript
if (effFlowData?.skipInitialMessage === true) {
  // Sempre substituir por vazio quando skipInitialMessage — não apenas dígitos
  console.log(`[process-buffered-messages] ⏭️ Conv ${convId}: skipInitialMessage=true → saudação proativa`);
  const greetSuccess = await callPipeline(supabase, {
    conversationId: convId,
    concatenatedMessage: "",
    // ... resto igual
  });
```

**Deploy:** `meta-whatsapp-webhook` + `process-buffered-messages`

### Resultado Esperado
- Menu selection "2" → buffer com `skipInitialMessage=true` → CRON detecta → chama AI com "" → saudação proativa "Olá! Sou Helper Financeiro..."
- Dados financeiros com "todo saldo" → `create_ticket` com string → ticket criado → confirmação com `formatAmount()`
- Zero crashes, zero "Não consegui resolver" falsos

