

# Plano: Corrigir Opções Não Formatadas no WhatsApp (Master Flow)

## Problema Identificado

O fluxo `ask_options` está retornando a mensagem corretamente, mas **as opções não estão sendo formatadas junto com a mensagem** antes de enviar ao WhatsApp.

### Evidência nos Logs
```json
{
  "response": "Seja bem-vindo à 3 Cliques! Antes de transferi-lo para um Cliquer, preciso saber: \nVocê já é nosso cliente?",
  "options": [{"label":"SIm","id":"opt_1769459506022"}, {"label":"Não","id":"opt_1769459507383"}]
}
```

### O que deveria aparecer no WhatsApp
```
Seja bem-vindo à 3 Cliques! Antes de transferi-lo para um Cliquer, preciso saber:
Você já é nosso cliente?

1️⃣ Sim
2️⃣ Não
```

### O que está aparecendo
```
Seja bem-vindo à 3 Cliques! Antes de transferi-lo para um Cliquer, preciso saber:
Você já é nosso cliente?
```
**(Sem as opções!)**

---

## Causa Raiz

No arquivo `supabase/functions/meta-whatsapp-webhook/index.ts` (linhas 556-577), o **CASO 2** envia apenas `flowData.response`:

```typescript
// CASO 2: Fluxo retornou resposta estática
if (!flowData.useAI && flowData.response) {
  await supabase.functions.invoke("send-meta-whatsapp", {
    body: {
      message: flowData.response,  // ❌ Ignora flowData.options!
      // ...
    },
  });
}
```

O campo `flowData.options` existe mas está sendo **ignorado**.

---

## Solução

### 1. Adicionar função `formatOptionsAsText` no meta-whatsapp-webhook

Mesma função já usada no `ai-autopilot-chat`:

```typescript
function formatOptionsAsText(options: Array<{label: string; value?: string}> | null | undefined): string {
  if (!options || options.length === 0) return '';
  
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  
  const formatted = options.map((opt, idx) => {
    const emoji = emojis[idx] || `${idx + 1}.`;
    return `${emoji} ${opt.label}`;
  }).join('\n');
  
  return `\n\n${formatted}`;
}
```

### 2. Modificar CASO 2 para incluir opções formatadas

```typescript
// CASO 2: Fluxo retornou resposta estática (Message/AskOptions/etc)
if (!flowData.useAI && flowData.response) {
  // 🆕 Formatar opções junto com a mensagem
  const formattedMessage = flowData.response + formatOptionsAsText(flowData.options);
  
  console.log("[AUTO-DECISION] [WhatsApp Meta] Flow static response → send-meta-whatsapp");
  await supabase.functions.invoke("send-meta-whatsapp", {
    body: {
      instance_id: instance.id,
      phone_number: fromNumber,
      message: formattedMessage,  // ✅ Inclui opções formatadas
      conversation_id: conversation.id,
      skip_db_save: false,
    },
  });
}
```

### 3. Atualizar tipagem de flowData

Adicionar `options` na interface:

```typescript
let flowData: {
  useAI?: boolean;
  aiNodeActive?: boolean;
  response?: string;
  options?: Array<{label: string; value?: string; id?: string}>;  // 🆕
  skipAutoResponse?: boolean;
  flow_context?: Record<string, unknown>;
} = {};
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/meta-whatsapp-webhook/index.ts` | Adicionar `formatOptionsAsText` + usar no CASO 2 |

---

## Fluxo Corrigido

```text
process-chat-flow retorna:
  response: "Mensagem..."
  options: [{label: "Sim"}, {label: "Não"}]
       │
       ▼
meta-whatsapp-webhook (CASO 2):
  formattedMessage = response + formatOptionsAsText(options)
       │
       ▼
send-meta-whatsapp:
  "Mensagem...\n\n1️⃣ Sim\n2️⃣ Não"
       │
       ▼
WhatsApp exibe mensagem completa ✅
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| "Você já é nosso cliente?" | "Você já é nosso cliente?\n\n1️⃣ Sim\n2️⃣ Não" |
| Opções ignoradas | Opções formatadas com emojis |

---

## Testes

| Cenário | Esperado |
|---------|----------|
| ask_options com 2 opções | "1️⃣ Sim\n2️⃣ Não" aparece |
| ask_options com 4 opções | "1️⃣...\n2️⃣...\n3️⃣...\n4️⃣..." |
| message sem options | Apenas mensagem (sem quebras extras) |
| options vazio | Apenas mensagem |

