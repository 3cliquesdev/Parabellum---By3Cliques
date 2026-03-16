
# Correção: AI Node Recebe Contexto da Opção Selecionada — ✅ IMPLEMENTADO

## Problema
Quando `ask_options` transitava para `ai_response`, o webhook enviava o número cru da seleção ("2") como `customerMessage` para a IA, que não encontrava nada na KB e acionava fallback.

## Correção Aplicada

### 1. `process-chat-flow/index.ts` — ✅ Flag `firstEntry`
- Bloco genérico (L2925): detecta `currentNode.type === 'ask_options' && selectedOption` → retorna `firstEntry: true, selectedOption: label`
- Bloco principal (L4307): mesma lógica com `isFirstEntryFromMenuMain`

### 2. `meta-whatsapp-webhook/index.ts` — ✅ Substituição contextual
- Path direto (L1305): `customerMessage` usa `"Cliente selecionou: {label}"` quando `firstEntry=true`
- Path batching (L1256): `bufferMessage` usa mesma substituição
- Propagação de `firstEntry` e `selectedOption` no flowData do buffer

### 3. Deploy — ✅ Realizado
- `process-chat-flow` e `meta-whatsapp-webhook` deployados
