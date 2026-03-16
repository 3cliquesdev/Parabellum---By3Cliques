

# Barrinhas estilo WhatsApp já estão implementadas

Analisando o código, o sistema **já possui** o componente `MessageStatusIndicator` com os 4 estados do WhatsApp:

- ✓ `sent` = 1 check cinza (enviado ao servidor)
- ✓✓ `delivered` = 2 checks cinza (entregue ao cliente)
- ✓✓ `read` = 2 checks azuis (lido)
- ⏳ `sending` = relógio pulsante
- ❌ `failed` = ícone de erro com tooltip

E o `MessageBubble` já renderiza esse indicador para mensagens de agente/IA (linha 268-276).

**O que pode estar acontecendo**: As mensagens estão sendo salvas com `status = 'sent'` mas nunca atualizadas para `delivered` ou `read` quando o webhook do WhatsApp retorna os status updates. Preciso verificar se o webhook `meta-whatsapp-webhook` está salvando os status `delivered` e `read` corretamente na tabela `messages`.

## Verificação necessária

Vou checar se o webhook processa os eventos de status (`delivered`, `read`) e atualiza o campo `status` na tabela `messages`.

---

Após análise do `meta-whatsapp-webhook`, o fluxo de status updates do WhatsApp já existe no código. As "barrinhas" já funcionam visualmente. O problema provável é que:

1. O campo `status` nas mensagens não está sendo populado corretamente ao enviar
2. Ou os webhooks de status update (`delivered`/`read`) não estão chegando/processando

## Plano

### 1. Confirmar que `send-meta-whatsapp` salva status `sent` após envio bem-sucedido
- Verificar se após enviar via API Meta, o status da mensagem é atualizado de `sending` → `sent`

### 2. Confirmar que `meta-whatsapp-webhook` processa status updates
- Verificar se eventos `statuses` do webhook atualizam o campo `status` para `delivered` e `read`

### 3. Se faltar algo, corrigir o pipeline de status

Preciso ler os arquivos das Edge Functions para confirmar o diagnóstico antes de propor correções específicas.

