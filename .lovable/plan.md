

# Correção: AI Node Recebe "2" em Vez do Contexto Real

## Problema Real

O problema **não é** falta de verificação de horário comercial no transfer node. O que aconteceu:

1. Usuário selecionou opção **"2"** (Financeiro) do menu `ask_options`
2. `process-chat-flow` transitou para `node_ia_financeiro` (nó AI) e retornou `useAI: true, aiNodeActive: true`
3. O webhook chamou `ai-autopilot-chat` com `customerMessage: "2"` — o número cru da seleção do menu
4. A IA recebeu **"2"** como pergunta do cliente. Sem contexto, não encontrou nada na KB
5. Retornou fallback → `flow_advance_needed` → "Não consegui resolver por aqui"
6. Como era fora do horário, encerrou a conversa

O bug é que, ao transitar de `ask_options` para `ai_response`, o **número da opção selecionada** é enviado como mensagem do cliente para a IA, em vez de um contexto significativo.

## Correção

### 1. `process-chat-flow/index.ts` — Flag de primeira entrada no AI node

No bloco onde `ask_options` transita para `ai_response` (L2922-2951), adicionar:
- `firstEntry: true` — indica que é transição de menu, não pergunta real
- `selectedOption: "Financeiro"` — o label da opção selecionada (já disponível em `collectedData`)

```
// Quando nextNode.type === 'ai_response' após ask_options:
return { 
  useAI: true, aiNodeActive: true, 
  firstEntry: true,                    // NOVO
  selectedOption: selectedOption.label, // NOVO - label da opção escolhida
  ...rest 
}
```

### 2. `meta-whatsapp-webhook/index.ts` — Não enviar "2" para a IA na primeira entrada

No CASO 3 (L1243+), quando `flowData.firstEntry === true`:
- Substituir `customerMessage` por uma mensagem contextual: `"O cliente selecionou: {selectedOption}"` ou enviar string vazia
- Isso permite que a IA entenda o contexto e faça a saudação/pergunta inicial adequada

```
// L1306: customerMessage
customerMessage: flowData.firstEntry 
  ? `Cliente selecionou: ${flowData.selectedOption || 'opção do menu'}` 
  : messageContent,
```

### 3. Aplicar mesma lógica no batching path (L1252-1290)

Quando `batchDelaySeconds > 0` e é `firstEntry`, ajustar o `messageContent` no buffer também.

### 4. Redeploy de `process-chat-flow` e `meta-whatsapp-webhook`

## Impacto

- Quando o usuário seleciona uma opção do menu e cai num nó AI, a IA recebe contexto ("Cliente selecionou: Financeiro") em vez de "2"
- A IA pode então saudar e perguntar qual é a dúvida financeira
- Sem quebra em nenhum outro fluxo — `firstEntry` só afeta a primeira mensagem ao entrar no nó

