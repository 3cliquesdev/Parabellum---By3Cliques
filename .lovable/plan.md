
# Plano: Preservação de Contexto da Conversa Após Verificação de Identidade

## Problema Identificado

A IA está perdendo o contexto original da conversa quando o cliente envia o email para verificação de identidade. No caso do screenshot:

1. Cliente queria falar sobre **cancelamento da assinatura Kiwify**
2. IA pediu email para identificação
3. Cliente enviou email: `marcrsil@msn.com`
4. IA encontrou o cadastro, mas **PERDEU o contexto de cancelamento**
5. Em vez de continuar sobre cancelamento, mostrou menu genérico: "1 - Pedidos, 2 - Sistema"

### Causa Raiz (Técnica)

No arquivo `supabase/functions/ai-autopilot-chat/index.ts`, quando o email é detectado e verificado (linhas 2375-2410):

```typescript
if (verifyResult.found) {
  // ❌ PROBLEMA: Resposta HARDCODED ignora contexto original
  foundMessage = `Encontrei seu cadastro, ${nome}! 🎉
  
Agora me diz: precisa de ajuda com:
**1** - Pedidos
**2** - Sistema`;

  // Marca awaiting_menu_choice e RETORNA IMEDIATAMENTE
  // ❌ NÃO considera o que o cliente PEDIU ANTES
  return new Response(...);
}
```

O sistema faz `RETURN EARLY` após verificar o email, sem:
1. Capturar a intenção original (cancelamento, reembolso, saque, etc.)
2. Passar essa intenção para a IA continuar a conversa

---

## Solução Proposta

### 1. Capturar e Salvar a Intenção Original

Quando o cliente envia a primeira mensagem (ex: "Quero cancelar minha assinatura"), salvar essa intenção no `customer_metadata` da conversa.

**Novo campo:** `original_intent`

```typescript
// Quando IA pede email, salvar intenção original
customer_metadata: {
  awaiting_email_for_handoff: true,
  original_intent: customerMessage, // "Quero cancelar minha assinatura Kiwify"
  original_intent_timestamp: new Date().toISOString()
}
```

### 2. Recuperar Contexto Após Verificação de Email

Após verificar o email com sucesso, em vez de mostrar menu genérico, **continuar no contexto original**:

```typescript
if (verifyResult.found) {
  const originalIntent = conversation.customer_metadata?.original_intent;
  
  if (originalIntent) {
    // ✅ CONTINUAR NO CONTEXTO ORIGINAL
    // Não mostrar menu genérico - deixar IA processar normalmente
    // A IA já tem o histórico de mensagens incluindo a intenção
    
    // Atualizar contato como identificado
    await supabaseClient.from('contacts').update({...});
    
    // NÃO retornar aqui - deixar fluxo normal da IA continuar
    // com o contexto preservado
  } else {
    // Sem intenção prévia - mostrar menu de triagem
    autoResponse = foundMessage;
  }
}
```

### 3. Melhorar o Histórico de Mensagens

Garantir que a IA sempre receba o histórico completo, incluindo a mensagem original sobre cancelamento, para que possa manter o contexto.

### 4. Detectar Intenções Conhecidas

Criar padrões de detecção para intenções comuns que devem ser preservadas:

| Padrão | Intenção |
|--------|----------|
| `cancelar`, `cancelamento`, `assinatura` | `cancellation` |
| `reembolso`, `devolver`, `devolução` | `refund` |
| `saque`, `sacar`, `carteira` | `withdrawal` |
| `rastreio`, `entrega`, `pedido` | `tracking` |

---

## Alterações Necessárias

### Arquivo: `supabase/functions/ai-autopilot-chat/index.ts`

#### Alteração 1: Salvar intenção original quando pedir email

```typescript
// Na seção onde marca awaiting_email_for_handoff
await supabaseClient.from('conversations').update({
  customer_metadata: {
    ...(conversation.customer_metadata || {}),
    awaiting_email_for_handoff: true,
    original_intent: customerMessage, // ← ADICIONAR
    original_intent_category: detectIntentCategory(customerMessage), // ← ADICIONAR
    handoff_blocked_at: new Date().toISOString(),
  }
}).eq('id', conversationId);
```

#### Alteração 2: Modificar fluxo após verificação de email bem-sucedida

Em vez de mostrar menu genérico, verificar se há intenção original e deixar a IA continuar normalmente:

```typescript
if (verifyResult.found) {
  const originalIntent = conversation.customer_metadata?.original_intent;
  const intentCategory = conversation.customer_metadata?.original_intent_category;
  
  // Atualizar contato como identificado
  await supabaseClient.from('contacts').update({...});
  
  // Limpar metadata de espera
  delete updatedMetadata.awaiting_email_for_handoff;
  delete updatedMetadata.original_intent; // Limpar após usar
  
  if (originalIntent) {
    // ✅ PRESERVAR CONTEXTO: Continuar com intenção original
    console.log('[ai-autopilot-chat] ✅ Recuperando contexto original:', originalIntent);
    
    // Mensagem de confirmação que mantém contexto
    const contextAwareMessage = `Encontrei seu cadastro, ${nome}! ✅\n\nVocê mencionou sobre ${intentCategory === 'cancellation' ? 'cancelamento' : intentCategory === 'refund' ? 'reembolso' : intentCategory === 'withdrawal' ? 'saque' : 'sua dúvida'}. Vou te ajudar com isso agora!`;
    
    // Salvar mensagem de confirmação
    await supabaseClient.from('messages').insert({...});
    
    // ❌ NÃO RETORNAR AQUI - deixar fluxo continuar para IA processar
    // A IA já tem o histórico incluindo a mensagem original
    
  } else {
    // Sem contexto prévio - mostrar menu de triagem
    return new Response(JSON.stringify({
      response: menuMessage,
      ...
    }));
  }
}
```

#### Alteração 3: Adicionar função de detecção de intenção

```typescript
function detectIntentCategory(message: string): string | null {
  const msgLower = message.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Cancelamento
  if (/cancel|assinatura|desinscrever/.test(msgLower)) return 'cancellation';
  
  // Reembolso
  if (/reembolso|devol|devolucao|trocar/.test(msgLower)) return 'refund';
  
  // Saque
  if (/saque|sacar|carteira|saldo|pix/.test(msgLower)) return 'withdrawal';
  
  // Rastreio
  if (/rastreio|entrega|pedido|envio/.test(msgLower)) return 'tracking';
  
  // Problema técnico
  if (/erro|bug|nao funciona|problema/.test(msgLower)) return 'technical';
  
  return null; // Intenção genérica
}
```

---

## Resultado Esperado

### Antes (Problema Atual)

```
Cliente: Quero cancelar minha assinatura Kiwify
IA: Para confirmar sua identidade, qual seu email?
Cliente: marcrsil@msn.com
IA: Encontrei seu cadastro, Marcos! 🎉
    Agora me diz: precisa de ajuda com:
    **1** - Pedidos  ← ❌ Perdeu contexto de cancelamento
    **2** - Sistema
```

### Depois (Com a Correção)

```
Cliente: Quero cancelar minha assinatura Kiwify
IA: Para confirmar sua identidade, qual seu email?
Cliente: marcrsil@msn.com
IA: Encontrei seu cadastro, Marcos! ✅
    Você mencionou sobre cancelamento. Vou te ajudar com isso agora!
    
    Para cancelar sua assinatura Kiwify, siga estes passos:
    1. Acesse sua conta na Kiwify
    2. Vá em "Minhas Assinaturas"
    3. Clique em "Cancelar"
    ... ← ✅ Manteve contexto de cancelamento
```

---

## Fluxo Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│  CLIENTE ENVIA: "Quero cancelar minha assinatura"               │
└────────────────────────┬────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  IA detecta: Cliente não identificado                           │
│  ✅ SALVAR: original_intent = "Quero cancelar..."              │
│  ✅ SALVAR: intent_category = "cancellation"                   │
│  IA responde: "Qual seu email?"                                 │
└────────────────────────┬────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  CLIENTE ENVIA: "marcrsil@msn.com"                              │
└────────────────────────┬────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Sistema verifica email → ENCONTRADO ✅                         │
│  ✅ RECUPERAR: original_intent = "Quero cancelar..."           │
│  ✅ RECUPERAR: intent_category = "cancellation"                │
│  IA responde com contexto: "Vou te ajudar com cancelamento!"    │
│  ⏩ Continua fluxo normal da IA com contexto preservado        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `supabase/functions/ai-autopilot-chat/index.ts` | Salvar `original_intent`, recuperar após verificação, função `detectIntentCategory` |

## Estimativa

- Complexidade: Média
- Impacto: Alto (melhora significativa na experiência do usuário)
- Regressão: Baixa (alterações isoladas no fluxo de verificação de email)
