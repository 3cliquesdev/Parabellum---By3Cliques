
# Bug: Menu de assunto reenviado apesar de opção já selecionada

## Diagnóstico Completo (Conv #E067D4BF)

### Timeline reconstruída do banco:
```text
14:22:13 Contact: "Boa tarde"
14:22:35 AI: Boas-vindas
14:22:36 AI: Menu Produto (3 opções)
14:23:19 Contact: "Nacional"
14:23:22 AI: Menu Assunto (6 opções) ← flow avançou para node_menu_assunto
14:23:35 AI: "Vi que você escolheu Drop Nacional — assunto: pedidos" ← flow JÁ no AI node
14:23:53 Contact: "Pedidos"
14:23:54 Contact: "Quero ver meus pedidos"
14:23:55 Contact: "Pedidos"
14:23:56 AI: "Desculpe, não entendi..." ← BUG! Menu reenviado
14:24:13 Contact: "Pedidos" (de novo)
14:25:09 AI: "Olá! Estou aqui para te ajudar sobre Drop Nacional 😊" ← finalmente processou
```

### Causa raiz confirmada: DOIS bugs combinados

**Bug 1 — Buffer concatena mensagens e matchAskOption falha:**
O `process-buffered-messages` concatena mensagens com `\n`. Quando o cliente digita rápido ("Pedidos\nQuero ver meus pedidos\nPedidos"), a string concatenada não faz match em nenhuma layer do `matchAskOption` porque:
- Layer 2 (exato): `"pedidos\nquero ver meus pedidos\npedidos"` ≠ `"pedidos"`
- Layer 4-6: múltiplos matches (ambíguo) ou nenhum

**Bug 2 — Race condition gera "Desculpe" duplicado:**
O flow já estava em `node_ia_pedidos` às 14:23:35 (AI respondeu com contexto). Mas uma chamada concorrente a `process-chat-flow` (do webhook processando as mensagens 14:23:53-55) encontrou o estado stale em `node_menu_assunto` e gerou o "Desculpe".

**Bug 3 — Emoji stripping inadequado no layer 7:**
O regex `[\u1000-\uFFFF]` não remove emojis do Supplementary Plane (📦 = U+1F4E6), comprometendo o fallback final do matcher.

---

## Plano de Correção

### 1. matchAskOption — Adicionar Layer 0: Split por `\n` (process-chat-flow)
Antes de rodar as 7 layers, dividir o input por `\n` e tentar cada linha individualmente (da última para a primeira). Se qualquer linha der match, retornar.

```typescript
// Layer 0: Multi-line (buffer concatenation)
const lines = userInput.trim().split('\n').map(l => l.trim()).filter(Boolean);
if (lines.length > 1) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = matchAskOption(lines[i], options);
    if (match) return match;
  }
}
// Continue com as 7 layers normais usando input original...
```

### 2. matchAskOption — Corrigir emoji strip no Layer 7
Substituir `[\u1000-\uFFFF]` por regex Unicode completo:
```typescript
const textOnlyLabel = opt.label
  .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
  .trim().toLowerCase();
```

### 3. Deduplicação de "Desculpe" no ask_options (process-chat-flow)
No handler `ask_options` (linha 3066), antes de retornar a mensagem de retry, verificar se já foi enviada uma mensagem idêntica nos últimos 30 segundos para evitar reenvio:

```typescript
if (!selectedOption) {
  // Check dedup: se já enviou retry recentemente, não repetir
  const { data: recentRetry } = await supabaseClient
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .like('content', 'Desculpe, não entendi%')
    .gte('created_at', new Date(Date.now() - 30000).toISOString())
    .limit(1)
    .maybeSingle();
  
  if (recentRetry) {
    // Já enviou retry recente, retornar silenciosamente
    return new Response(JSON.stringify({
      useAI: false, skipAutoResponse: true, reason: 'dedup_retry'
    }), ...);
  }
  // ... código original do retry
}
```

### 4. Mesma dedup no safety net do existingActiveFlowState (linha 4956)
Aplicar a mesma lógica de deduplicação no fallback genérico que retorna "Desculpe" quando encontra estado ativo mas sem trigger match.

### 5. Deploy
Após as edições, deploy imediato de `process-chat-flow`.

### Arquivos afetados
- `supabase/functions/process-chat-flow/index.ts` — matchAskOption + dedup em 2 pontos

### Impacto
- Elimina falsos "Desculpe" quando buffer concatena mensagens
- Previne menus duplicados por race condition
- Melhora reconhecimento de opções com emojis
