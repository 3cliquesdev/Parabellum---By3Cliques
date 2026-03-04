

# Plano: Impedir "Transferência Falsa" com Token [[FLOW_EXIT]] e Avanço Automático

## Problema raiz

A IA gera texto como "Vou te direcionar para nosso menu de atendimento" — promete transferência mas não executa nada. Dois gaps:

1. **Prompt**: não dá à IA uma saída válida quando ela "quer transferir"
2. **ESCAPE_PATTERNS**: padrões incompletos e emoji 1️⃣ gera falso positivo
3. **Webhook WhatsApp**: não intercepta `contractViolation` — só o `message-listener` faz isso

## Solução em 3 frentes

### 1. System Prompt: Token `[[FLOW_EXIT]]`

**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts` (~linha 5757)

Substituir `flowAntiTransferInstruction` por:

```
VOCÊ ESTÁ EM UM FLUXO AUTOMATIZADO.
PROIBIDO dizer que vai transferir/direcionar/encaminhar/conectar/passar.
PROIBIDO mencionar atendente/especialista/consultor/menu/departamento/setor.
PROIBIDO criar opções numeradas (1️⃣ 2️⃣).
Se você conseguir resolver, responda normalmente.
Se NÃO conseguir resolver, responda SOMENTE: [[FLOW_EXIT]]
Nenhum texto antes ou depois de [[FLOW_EXIT]].
```

### 2. ESCAPE_PATTERNS: Refinar com semântica + detectar `[[FLOW_EXIT]]`

**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts` (~linha 1199)

Substituir a lista atual por padrões agrupados por intenção:

```typescript
const ESCAPE_PATTERNS = [
  // Token explícito de saída
  /\[\[FLOW_EXIT\]\]/i,
  // Promessa de ação de transferência
  /(vou|irei|posso)\s+(te\s+)?(direcionar|redirecionar|transferir|encaminhar|conectar|passar)/i,
  /(estou|estarei)\s+(te\s+)?(direcionando|redirecionando|transferindo|encaminhando|conectando)/i,
  // Menção a humano/atendente
  /\b(aguarde|só um instante).*(atendente|especialista|consultor)\b/i,
  /\b(chamar|acionar).*(atendente|especialista|consultor)\b/i,
  // Menu de atendimento (caso específico)
  /menu\s+de\s+atendimento/i,
  // Opções numeradas (2+ emojis para evitar falso positivo)
  /[1-9]️⃣.*[1-9]️⃣/s,
  // Menus textuais
  /escolha uma das op[çc][õo]es/i,
  /selecione uma op[çc][ãa]o/i,
];
```

**Mudanças vs. atual:**
- Consolida ~26 patterns em ~10 semânticos (menos falso positivo)
- Emoji: exige **2 ou mais** ocorrências (não bloqueia "1️⃣" isolado)
- Adiciona `[[FLOW_EXIT]]` como padrão reconhecido

### 3. Handler de `contractViolation`: Distinguir `[[FLOW_EXIT]]` vs. escape genérico

**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts` (~linha 8143)

Quando detectar escape dentro de `flow_context`:

- Se a resposta é exatamente `[[FLOW_EXIT]]` → retornar `flowExit: true` (sinal limpo para o motor avançar)
- Se é escape genérico (texto enganoso) → retornar `contractViolation: true` como hoje

```typescript
if (escapeAttempt) {
  const isCleanExit = /^\s*\[\[FLOW_EXIT\]\]\s*$/.test(assistantMessage);
  
  if (isCleanExit) {
    // IA pediu saída educadamente via token
    return { flowExit: true, reason: 'ai_requested_exit' };
  } else {
    // IA tentou fabricar transferência
    return { contractViolation: true, reason: 'ai_contract_violation' };
  }
}
```

### 4. Webhook WhatsApp: Interceptar `contractViolation` e `flowExit`

**Arquivo:** `supabase/functions/meta-whatsapp-webhook/index.ts` (~linha 1137)

Após `autopilotResponse.json()`, adicionar handler (igual ao que `message-listener` já faz):

```typescript
// Após: const autopilotData = await autopilotResponse.json();

if (autopilotData?.flowExit || autopilotData?.contractViolation) {
  // Re-invocar process-chat-flow com forceAIExit para avançar ao próximo nó
  await fetch(process-chat-flow, { 
    body: { conversationId, userMessage, forceAIExit: true }
  });
  // Enviar mensagem do próximo nó se houver + aplicar transfer se retornado
  continue;
}
```

Isso fecha o gap: hoje o webhook ignora `contractViolation` e a conversa fica "muda".

### 5. Process-chat-flow: Handler `forceAIExit`

**Arquivo:** `supabase/functions/process-chat-flow/index.ts`

Verificar se `forceAIExit` já está implementado (o param é recebido na linha 518). Se não estiver, adicionar handler que:
- Busca o flow state ativo
- Avança do nó `ai_response` atual para o próximo nó (edge `ai_exit` ou default)
- Retorna mensagem/transfer do próximo nó

## Arquivos impactados (3-4)

1. `supabase/functions/ai-autopilot-chat/index.ts` — prompt + ESCAPE_PATTERNS + handler
2. `supabase/functions/meta-whatsapp-webhook/index.ts` — interceptar contractViolation/flowExit
3. `supabase/functions/process-chat-flow/index.ts` — garantir handler forceAIExit funciona
4. (se necessário) `supabase/functions/message-listener/index.ts` — alinhar com novo sinal `flowExit`

## Resultado

```text
Cliente: "quero falar com alguém"
IA (antes): "Vou te direcionar para nosso menu de atendimento" ← FALSO
IA (agora): [[FLOW_EXIT]] ← token silencioso
Engine: detecta flowExit → avança para TransferNode no canvas → executa transferência real
```

Zero transferência falsa. A IA nunca mais promete o que não pode cumprir.

