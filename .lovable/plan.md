
# Plano: Formatar Opções de Múltipla Escolha no Fluxo

## Problema Identificado

Quando o Fluxo Mestre exibe um nó de "Múltipla Escolha" (`ask_options`), a IA envia a pergunta mas **não inclui as opções disponíveis** na mensagem. O cliente vê:

```
"Queremos oferecer o suporte ideal para você! 
Qual dessas opções melhor se encaixa no que você precisa?"
```

Mas deveria ver:

```
"Queremos oferecer o suporte ideal para você! 
Qual dessas opções melhor se encaixa no que você precisa?

1️⃣ Drop Nacional
2️⃣ Drop Internacional  
3️⃣ Drop Híbrido
4️⃣ 3 Cliques Clube"
```

## Causa Raiz

O `process-chat-flow` retorna:
```json
{
  "response": "Qual dessas opções melhor se encaixa?",
  "options": [
    {"label": "Drop Nacional", "value": "drop_nacional"},
    {"label": "Drop Internacional", "value": "drop_internacional"},
    ...
  ]
}
```

Mas o `ai-autopilot-chat` **salva e envia apenas `flowResult.response`** nas linhas 1730 e 1758 - ignorando completamente o array `options`.

---

## Solução

Criar uma função helper que formata as opções como texto numerado e anexá-la à mensagem **antes de salvar/enviar**.

### FASE 1: Criar Helper de Formatação

**Arquivo: `supabase/functions/ai-autopilot-chat/index.ts`**

Adicionar função próximo ao topo (após helpers existentes):

```typescript
// ============================================================
// 🔢 HELPER: Formatar opções de múltipla escolha como texto
// ============================================================
function formatOptionsAsText(options: Array<{label: string; value: string}> | null): string {
  if (!options || options.length === 0) return '';
  
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  
  const formatted = options.map((opt, idx) => {
    const emoji = emojis[idx] || `${idx + 1}.`;
    return `${emoji} ${opt.label}`;
  }).join('\n');
  
  return `\n\n${formatted}`;
}
```

### FASE 2: Aplicar Formatação ao Enviar/Salvar

**Arquivo: `supabase/functions/ai-autopilot-chat/index.ts`**

Modificar seção onde `flowResult.response` é usado (linhas ~1725-1762):

```typescript
// ANTES (linha 1725-1736):
const { data: flowMsgData } = await supabaseClient
  .from("messages")
  .insert({
    content: flowResult.response,  // ❌ Sem opções
    ...
  });

// DEPOIS:
// 🆕 Formatar mensagem com opções (se houver)
const formattedResponse = flowResult.response + formatOptionsAsText(flowResult.options);

const { data: flowMsgData } = await supabaseClient
  .from("messages")
  .insert({
    content: formattedResponse,  // ✅ Com opções formatadas
    ...
  });
```

**Mesma correção para envio WhatsApp (linha ~1754-1761):**

```typescript
// ANTES:
await sendWhatsAppMessage(
  ...
  flowResult.response,  // ❌ Sem opções
  ...
);

// DEPOIS:
await sendWhatsAppMessage(
  ...
  formattedResponse,  // ✅ Com opções formatadas
  ...
);
```

### FASE 3: Atualizar Retorno da API

**Também atualizar o JSON de resposta:**

```typescript
return new Response(
  JSON.stringify({
    response: formattedResponse,  // ✅ Resposta completa com opções
    messageId: flowMsgData?.id,
    source: 'chat_flow_early',
    flowId: flowResult.flowId,
    options: flowResult.options,  // Manter array para uso no frontend
    ...
  }),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

---

## Arquivos a Modificar

| Arquivo | Alteração | Impacto |
|---------|-----------|---------|
| `supabase/functions/ai-autopilot-chat/index.ts` | Adicionar `formatOptionsAsText()` helper | Nenhum |
| `supabase/functions/ai-autopilot-chat/index.ts` | Usar `formattedResponse` ao salvar/enviar | Corrige o problema |

---

## Fluxo Após Correção

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ FLUXO CORRIGIDO - ASK_OPTIONS                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Cliente: "Olá"                                                               │
│         │                                                                     │
│         ▼                                                                     │
│  ┌─────────────────────────────────────────────┐                             │
│  │ 1. Master Flow detecta mensagem inicial     │                             │
│  │    → Encontra nó ask_options                │                             │
│  └─────────────────────────────────────────────┘                             │
│         │                                                                     │
│         ▼                                                                     │
│  ┌─────────────────────────────────────────────┐                             │
│  │ 2. process-chat-flow retorna:               │                             │
│  │    response: "Qual dessas opções..."        │                             │
│  │    options: [{label: "Drop Nacional"}, ...] │                             │
│  └─────────────────────────────────────────────┘                             │
│         │                                                                     │
│         ▼                                                                     │
│  ┌─────────────────────────────────────────────┐                             │
│  │ 3. ai-autopilot-chat formata:               │                             │
│  │    "Qual dessas opções melhor se encaixa?   │                             │
│  │                                             │                             │
│  │     1️⃣ Drop Nacional                        │ ← NOVO!                     │
│  │     2️⃣ Drop Internacional                   │                             │
│  │     3️⃣ Drop Híbrido                         │                             │
│  │     4️⃣ 3 Cliques Clube"                     │                             │
│  └─────────────────────────────────────────────┘                             │
│         │                                                                     │
│         ▼                                                                     │
│  ┌─────────────────────────────────────────────┐                             │
│  │ 4. Envia via WhatsApp com opções visíveis   │                             │
│  └─────────────────────────────────────────────┘                             │
│         │                                                                     │
│         ▼                                                                     │
│  Cliente vê: "1️⃣ Drop Nacional..."                                            │
│  Cliente responde: "1" ou "Drop Nacional"                                     │
│         │                                                                     │
│         ▼                                                                     │
│  ┌─────────────────────────────────────────────┐                             │
│  │ 5. process-chat-flow processa resposta:     │                             │
│  │    → Match por label ou value               │                             │
│  │    → Segue para próximo nó do fluxo         │                             │
│  └─────────────────────────────────────────────┘                             │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Pergunta sem opções | Pergunta com opções numeradas |
| Cliente não sabe o que responder | Cliente vê: 1️⃣ Drop Nacional, 2️⃣ Drop Internacional... |
| Fluxo não avança | Cliente responde "1" ou "Drop Nacional" → fluxo continua |

---

## Nota sobre Matching de Respostas

O `process-chat-flow` já suporta matching por `label` ou `value` (linhas 400-407):

```typescript
if (currentNode.type === 'ask_options') {
  const selectedOption = options.find((opt: any) => 
    opt.label.toLowerCase() === userMessage.toLowerCase() ||
    opt.value.toLowerCase() === userMessage.toLowerCase()
  );
}
```

Precisaremos adicionar também matching numérico ("1", "2", etc.) para melhor UX:

```typescript
// Matching por número (1, 2, 3...)
const numericChoice = parseInt(userMessage.trim());
if (!isNaN(numericChoice) && numericChoice >= 1 && numericChoice <= options.length) {
  selectedOption = options[numericChoice - 1];
}
```

Esta será uma melhoria adicional no `process-chat-flow` para aceitar respostas numéricas.
