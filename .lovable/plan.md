

# Auditoria: Resíduos de Lógica Antiga que Podem Causar Erros

Após varrer o `ai-autopilot-chat/index.ts` (~10.165 linhas), identifiquei 5 resíduos de lógica que ainda podem causar os bugs reportados.

---

## Resíduo 1: "Código inválido" ainda pode disparar indevidamente (BUG 1 parcial)

**Linha 6144**: O guard de "formato inválido de OTP" ainda intercepta mensagens com dígitos quando `hasOTPPendingContext` é true:
```typescript
if (!shouldValidateOTP && hasOTPPendingContext && otpDigitsOnly.length > 0 && otpDigitsOnly.length !== 6)
```

O fix do BUG 1 removeu `hasFirstContactOTPPending`, mas o problema persiste se o OTP já foi enviado (`hasAwaitingOTP = true`) e o cliente envia uma mensagem como "já fazem 3 dias" — `otpDigitsOnly = "3"`, length = 1, dispara "Código inválido".

**Correção:** Adicionar condição mínima — só tratar como tentativa de OTP se a mensagem for **majoritariamente numérica** (ex: `otpDigitsOnly.length >= 4`), pois ninguém digita 1-3 dígitos como OTP.

---

## Resíduo 2: Saudação proativa SEM guard de "já enviou" (BUG 2 — Loop de saudação)

**Linhas 7262-7268**: A saudação proativa dispara sempre que `isFirstNodeInteraction` (interaction_count === 0 ou undefined) ou `isMenuNoise`. Não há guard para verificar se a saudação já foi enviada naquele nó.

O `interaction_count` vem do `flow_context.collectedData.__ai.interaction_count`, que é gerenciado pelo `process-chat-flow`. Se o motor de fluxos não incrementou o contador (ex: após `contract_violation_blocked` que substitui a resposta), a saudação dispara novamente.

**Correção:** Salvar flag `greeting_sent_for_node_{nodeId}` no `customer_metadata` ao enviar a saudação. Verificar antes de enviar. Isso impede loops mesmo se `interaction_count` não estiver sincronizado.

---

## Resíduo 3: `getWhatsAppInstanceForConversation` com assinatura inconsistente

**Linha 6160-6164** (bloco OTP inválido):
```typescript
getWhatsAppInstanceForConversation(supabaseClient, conversationId, conversation.whatsapp_instance_id, conversation)
```
**Linhas 7310-7313** (saudação proativa):
```typescript
getWhatsAppInstanceForConversation(supabaseClient, conversationId, conversation)
```

A assinatura da função é chamada com 4 parâmetros em um lugar e 3 em outro. Se a função espera 3 parâmetros, a chamada na linha 6160 passa `conversation.whatsapp_instance_id` como 3º argumento (string) em vez do objeto `conversation`, o que pode causar falha silenciosa no envio de WhatsApp para mensagens de "código inválido".

**Correção:** Unificar todas as chamadas para a mesma assinatura de 3 parâmetros.

---

## Resíduo 4: Fallback `isFinancialRequest` pede email desnecessariamente (BUG 4 parcial)

**Linha 7431-7433**: Quando a IA retorna vazio e `isFinancialRequest` é true:
```typescript
} else if (isFinancialRequest) {
  assistantMessage = 'Posso ajudar com sua dúvida financeira! Como posso te ajudar?';
```

O `isFinancialRequest` inclui keywords como "saldo", "pix", "dinheiro" — perguntas como "cadê meu pix" matcheiam aqui e recebem "Posso ajudar com sua dúvida financeira!" mesmo quando o contexto é uma cobrança ativa (saque pendente). O cliente já explicou o problema e receber uma pergunta genérica como "como posso te ajudar?" é frustrante.

**Correção:** Mudar para resposta contextualizada: "Entendi sua situação. Vou verificar o que está acontecendo. Pode me informar mais detalhes?" ou encaminhar diretamente.

---

## Resíduo 5: `FINANCIAL_ACTION_PATTERNS` confunde consulta com ação

**Linhas 1081-1084**: Os patterns "sem OTP" incluem:
```
/não\s+(recebi|caiu|chegou)\s+(o\s+)?(pix|pagamento|saldo|dinheiro)/i
```

"Não recebi meu dinheiro" é classificado como `isFinancialRequest` (consulta) mas pode ser uma cobrança sobre saque pendente. Esse pattern compete com `WITHDRAWAL_ACTION_PATTERNS` onde "saque não caiu" exige OTP. Se a mensagem não contém a palavra "saque" explicitamente (ex: "não recebi o dinheiro do meu pedido"), o sistema trata como consulta informativa em vez de ação.

**Correção:** Sem mudança de código — mas documentar essa ambiguidade e considerar verificar se há saque pendente no metadata antes de classificar.

---

## Plano de Correções

### A. Guard mínimo no "código inválido" (Resíduo 1)
- Mudar `otpDigitsOnly.length > 0` para `otpDigitsOnly.length >= 4` na linha 6144
- Mensagens com 1-3 dígitos não são tentativas de OTP

### B. Flag de saudação por nó (Resíduo 2)
- Ao enviar saudação proativa, salvar `greeting_sent_node_{nodeId}: true` no `customer_metadata`
- Antes de enviar, verificar se a flag já existe para o nó atual
- Impede loop de saudação mesmo com `interaction_count` dessincronizado

### C. Unificar assinatura de WhatsApp (Resíduo 3)
- Padronizar chamada na linha 6160 para `getWhatsAppInstanceForConversation(supabaseClient, conversationId, conversation)`

### D. Fallback financeiro contextualizado (Resíduo 4)
- Substituir "Posso ajudar com sua dúvida financeira!" por mensagem que reconhece o contexto do cliente

### E. Deploy
- Redeploiar `ai-autopilot-chat`

