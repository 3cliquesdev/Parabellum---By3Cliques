

# Fix: Opções do ask_options não sendo enviadas no WhatsApp

## Problema
Quando a IA não consegue resolver e dispara `forceAIExit`, o `process-chat-flow` avança para o nó "Escape Pedidos" (ask_options) e retorna `response` + `options` corretamente. Porém, o `process-buffered-messages` ignora o campo `options` em dois caminhos:

1. **`handleFlowReInvoke`** (linha ~657): só extrai `flowResult.response`, sem concatenar as opções
2. **Caminho "global static response"** (linha ~603): envia `flowResult.response` sem opções

O webhook Meta já usa `formatOptionsAsText()` em todos os locais equivalentes — falta apenas no `process-buffered-messages`.

## Solução

### Arquivo: `supabase/functions/process-buffered-messages/index.ts`

1. **Adicionar a função `formatOptionsAsText`** (copiar da `meta-whatsapp-webhook`): formata array de opções como lista numerada com emojis (1️⃣, 2️⃣, etc.)

2. **`handleFlowReInvoke`** (~linha 657): mudar de:
   ```typescript
   const flowMessage = flowResult.response || flowResult.message;
   ```
   para:
   ```typescript
   const flowMessageRaw = flowResult.response || flowResult.message;
   const flowMessage = flowMessageRaw
     ? flowMessageRaw + formatOptionsAsText(flowResult.options)
     : null;
   ```

3. **Caminho "global static response"** (~linha 609): mudar de:
   ```typescript
   message: flowResult.response as string,
   ```
   para:
   ```typescript
   message: (flowResult.response as string) + formatOptionsAsText(flowResult.options),
   ```

### Deploy
- `process-buffered-messages`

