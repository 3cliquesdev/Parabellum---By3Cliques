

# Fix: Coluna `metadata` não existe na tabela `conversations`

## Problema

A mensagem do WhatsApp chegou no webhook (02:39:35) mas falhou ao criar a conversa com o erro:
```
column conversations.metadata does not exist
```

A coluna real se chama **`customer_metadata`**, não `metadata`. O fix anterior adicionou `metadata` incorretamente nos `.select()`.

## Correções no `supabase/functions/meta-whatsapp-webhook/index.ts`

### 1. Remover `metadata` dos 3 `.select()` (linhas 551, 572, 580)

Trocar:
```
.select("..., customer_metadata, department, metadata")
```
Por:
```
.select("..., customer_metadata, department")
```

### 2. Trocar `metadata` por `customer_metadata` nos `.update()` (linhas 926 e 943)

Trocar:
```typescript
metadata: {
  ...(conversation.metadata || {}),
```
Por:
```typescript
customer_metadata: {
  ...(conversation.customer_metadata || {}),
```

Nos dois locais (linhas 926-927 e 943-944).

### 3. Deploy do `meta-whatsapp-webhook`

**Total: 5 locais alterados + redeploy**

Resultado: Mensagens do WhatsApp voltarão a criar conversas e aparecer no CRM.

