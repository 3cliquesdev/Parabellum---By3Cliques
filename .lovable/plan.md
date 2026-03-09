

# Fix: Alucinação repetitiva da IA ("Vou te direcionar para nosso menu de atendimento")

## Problema identificado

A conversa #3BEA67E9 mostra a IA enviando 5+ vezes a mesma mensagem alucinada: "Vou te direcionar para nosso menu de atendimento para encontrar o especialista certo! 🎯".

**Causa raiz**: O webhook `handle-whatsapp-event` (Evolution API) tem duas falhas graves que o `meta-whatsapp-webhook` (Meta API) já resolveu:

1. **Sem `flow_context` na chamada da IA** -- Quando o fluxo retorna `useAI: true, aiNodeActive: true`, o webhook chama `ai-autopilot-chat` SEM `flow_context`. Sem flow_context, a verificação de ESCAPE_PATTERNS (que bloqueia a IA de fabricar transferências/menus) é completamente ignorada.

2. **Sem handling de `flowExit`/`contractViolation`** -- Quando a IA detecta que fabricou uma transferência e retorna `contractViolation: true`, o `handle-whatsapp-event` ignora completamente e a mensagem alucinada é enviada. A cada nova mensagem do cliente, o mesmo ciclo repete.

```text
FLUXO ATUAL (handle-whatsapp-event):
  Cliente envia msg → process-chat-flow → useAI=true, aiNodeActive=true
                    → ai-autopilot-chat (SEM flow_context!)
                    → IA alucina "vou te direcionar para menu..."
                    → Mensagem enviada sem filtro ← LOOP INFINITO

FLUXO CORRETO (meta-whatsapp-webhook):
  Cliente envia msg → process-chat-flow → useAI=true, aiNodeActive=true
                    → ai-autopilot-chat (COM flow_context!)
                    → ESCAPE_PATTERN detectado → contractViolation=true
                    → Re-invoca process-chat-flow com forceAIExit
                    → Avança para próximo nó (transfer/menu)
```

## Solução

Alinhar `handle-whatsapp-event` com a lógica já implementada no `meta-whatsapp-webhook`:

### Alteração 1: Passar `flow_context` quando `aiNodeActive=true` (linhas ~1186-1252)

Quando o fluxo retorna `useAI: true, aiNodeActive: true`, construir e passar `flow_context` na chamada de `ai-autopilot-chat` com todos os campos: `flow_id`, `node_id`, `response_format: 'text_only'`, `allowedSources`, `personaId`, `kbCategories`, `fallbackMessage`, `objective`, `maxSentences`, `forbidQuestions`, `forbidOptions`, `forbidFinancial`, `forbidCommercial`.

### Alteração 2: Tratar `flowExit`/`contractViolation` na resposta da IA

Após receber resposta da IA, verificar `autopilotData.flowExit || autopilotData.contractViolation`. Se detectado, re-invocar `process-chat-flow` com `forceAIExit: true` para avançar ao próximo nó (transfer/end/message), igual ao `meta-whatsapp-webhook` faz nas linhas 1583-1698.

### Alteração 3: Anti-duplicação de mensagem alucinada

Adicionar `flowHandled = true` quando `flowResult.aiNodeActive === true` para evitar que a IA seja chamada no caminho antigo (sem flow_context). A chamada com flow_context será feita no novo bloco.

### Impacto

- Corrige alucinações repetitivas no canal Evolution API (WhatsApp)
- Alinha os dois webhooks para comportamento idêntico
- Nenhum impacto no `meta-whatsapp-webhook` (já funciona corretamente)
- Preserva toda lógica existente de fluxo, kill switch, CSAT guard

### Arquivo afetado
- `supabase/functions/handle-whatsapp-event/index.ts` (linhas ~1186-1290)

