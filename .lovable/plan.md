

# Problema: Conversa fechada antes do cliente responder ao V4

## Diagnóstico confirmado

1. V4 foi ativado manualmente na `#7748AAC2` com `__manual_test: true` ✅
2. Saudação enviada: "Olá! Bem-vindo ao atendimento 3Cliques" ✅  
3. Mas a conversa `#7748AAC2` estava com `status: closed` e `is_test_mode: false`
4. Quando o cliente respondeu "Meu pedido não foi enviado", o webhook criou a conversa `#8CBCBCF1` (nova)
5. A nova conversa caiu no Master Flow antigo (`e44da799`)

## Causa raiz

O `TestModeDropdown.handleSelectFlow` ativa o V4, mas **não reabre a conversa** se ela estiver fechada. O flow processa e envia a saudação via WhatsApp, mas quando o cliente responde, o webhook (`meta-whatsapp-webhook`) detecta que a conversa está `closed` e cria uma nova — que não tem o V4, não tem test mode, e pega o fluxo padrão.

## Correção proposta

### `src/components/inbox/TestModeDropdown.tsx`

No `handleSelectFlow`, adicionar reabertura da conversa antes de ativar o teste:

```typescript
// Após limpar metadata, antes de chamar process-chat-flow:
const { error: updateError } = await supabase
  .from("conversations")
  .update({ 
    is_test_mode: true, 
    ai_mode: 'autopilot',
    status: 'open',  // ← ADICIONAR: reabrir conversa
    customer_metadata: cleanMetadata,
  })
  .eq("id", conversationId);
```

### Impacto
- Conversa é reaberta atomicamente junto com a ativação do teste
- Quando o cliente responder, o webhook encontra a conversa aberta e envia a mensagem para ela (não cria nova)
- O TEST MODE GUARD protege contra auto-triggers do Master Flow
- Nenhuma mudança no backend necessária

### Encoding (problema secundário)
Os logs mostram `"informaÃ§Ãµes"` e `"NÃ£o"` — encoding UTF-8 corrompido nas respostas da IA na conversa `#7748AAC2`. Isso já foi corrigido na sessão anterior com o fix de charset headers.

