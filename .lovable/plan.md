
## Plano: Simplificar Sistema - Priorizar Chat Flows sobre Triagem

### Diagnóstico

Identifiquei **3 problemas principais**:

1. **Ordem de execução errada**: A triagem (menu 1/2) acontece ANTES da verificação de Chat Flows
2. **Trigger genérico demais**: O trigger "Olá vim pelo email..." faz match com qualquer mensagem que contenha "Olá" 
3. **Fluxo incompleto**: O Fluxo de Carnaval não tem nó de resposta IA - vai direto para transfer

### Solução Proposta

Reorganizar a lógica para priorizar Chat Flows sobre a triagem genérica.

---

### Mudanças no Código

**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts`

**Mudança 1: Mover verificação de Chat Flow para ANTES da triagem**

Atualmente:
```
1. Email detection (linha 1440-1605)
2. Triagem inteligente (linha 1203-1440) ← Problema!
3. Chat Flow detection (linha 1609-1746)
```

Proposta:
```
1. Email detection 
2. Chat Flow detection ← MOVIDO PARA ANTES
3. Triagem inteligente (só se Chat Flow não encontrou match)
```

**Mudança 2: Corrigir lógica de match em `process-chat-flow`**

O problema está na linha 533 de `supabase/functions/process-chat-flow/index.ts`:
```typescript
// Match 2: Trigger contém a mensagem - MUITO PERMISSIVO!
if (triggerNorm.includes(messageNorm) && messageNorm.length >= 10)
```

Proposta: Inverter a lógica para que apenas triggers CURTOS (keywords) usem essa lógica, não frases longas.

```typescript
// Match 2: Trigger contém a mensagem 
// Só aplica se TRIGGER é curto (keyword) E mensagem é longa
if (triggerNorm.length < 30 && triggerNorm.includes(messageNorm) && messageNorm.length >= 10)
```

---

### Correção Imediata do Fluxo de Carnaval

O fluxo atual:
```
[Start] → [Transfer para Comercial]
```

Deveria ser:
```
[Start] → [Resposta IA] → [Transfer para Comercial] (opcional)
```

Para corrigir:
1. Adicionar um nó "Resposta IA" no fluxo de carnaval
2. Configurar persona/KB apropriada para responder sobre promoções
3. Ou: usar trigger keyword mais específico como "pré carnaval" ou "promoção carnaval"

---

### Alternativa: Usar apenas OpenAI

Como você sugeriu, simplificar para usar apenas OpenAI:

1. **Desativar** a triagem de menu (1/2) para clientes que mencionam intenções específicas
2. **Deixar a IA responder** diretamente sobre promoções usando a Knowledge Base
3. **Chat Flows** seriam usados apenas para coleta de dados estruturados (nome, email, CPF)

Essa abordagem:
- Reduz complexidade do sistema
- Aproveita a inteligência do modelo para entender contexto
- Evita loops de menus que frustram clientes

---

### Implementação Técnica

**1. Mover Chat Flow check para antes da triagem (ai-autopilot-chat ~linha 1200):**

```typescript
// ============================================================
// 🆕 PRIORIDADE 1: Chat Flow (ANTES da triagem)
// ============================================================
let flowProcessedEarly = false;

try {
  const { data: flowResult, error: flowError } = await supabaseClient.functions.invoke(
    'process-chat-flow',
    { body: { conversationId, userMessage: customerMessage } }
  );
  
  if (!flowError && flowResult && flowResult.useAI === false && flowResult.response) {
    // Flow encontrou match e tem resposta - pular triagem
    flowProcessedEarly = true;
    // ... processar resposta do flow ...
  }
} catch (e) {
  console.error('[ai-autopilot-chat] Chat Flow check failed:', e);
}

// 🎯 TRIAGEM: Só executa se Chat Flow não processou
if (!flowProcessedEarly) {
  // ... lógica de triagem atual ...
}
```

**2. Corrigir lógica de match (process-chat-flow linha 531-537):**

```typescript
// Match 2: Só aplica se trigger é keyword curto (< 30 chars)
if (triggerNorm.length < 30 && triggerNorm.includes(messageNorm) && messageNorm.length >= 10) {
  console.log('[process-chat-flow] ✅ Match reverso (keyword curto):', trigger);
  matchedFlow = flow;
  break;
}
```

---

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/ai-autopilot-chat/index.ts` | Mover Chat Flow check para antes da triagem |
| `supabase/functions/process-chat-flow/index.ts` | Corrigir lógica de match reverso |

---

### Resultado Esperado

Após as mudanças:
1. Cliente envia "vim pelo email e gostaria de saber da promoção de pré carnaval"
2. Chat Flow detecta match com Fluxo de Carnaval
3. Se fluxo tem nó de resposta IA: IA responde sobre promoção
4. Se fluxo tem transfer: transfere para Comercial
5. Triagem de menu (1/2) é IGNORADA

---

### Recomendação Adicional

Para o Fluxo de Carnaval funcionar como você espera:
- Adicionar nó **Resposta IA** entre Start e Transfer
- Configurar persona/KB para responder sobre promoções
- Ou: mudar trigger para keywords específicos como `["pré carnaval", "promoção carnaval", "desconto carnaval"]`
