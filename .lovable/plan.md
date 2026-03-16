

# Correção: `department_id` → `department` no meta-whatsapp-webhook

## Problema
Os logs mostram claramente:
```
column conversations.department_id does not exist
hint: Perhaps you meant to reference the column "conversations.department"
```

Isso faz com que:
1. O INSERT da nova conversa falhe (o `.select()` pede `department_id` que não existe)
2. O fallback da race condition também falhe (mesmo `.select()` errado)
3. Resultado: `conversation = undefined` → mensagem não chega no CRM

## Correção
Trocar `department_id` por `department` em **3 SELECTs** do arquivo `supabase/functions/meta-whatsapp-webhook/index.ts`:

- **Linha 550**: busca de conversa existente
- **Linha 571**: select após insert de nova conversa  
- **Linha 579**: fallback da race condition

**De:** `"id, ai_mode, status, assigned_to, awaiting_rating, whatsapp_provider, customer_metadata, department_id"`
**Para:** `"id, ai_mode, status, assigned_to, awaiting_rating, whatsapp_provider, customer_metadata, department"`

Adicionalmente, verificar as referências a `conversation.department_id` no restante do arquivo (linhas 843-873) e alinhar com `department`.

## Deploy
Deploy individual apenas de `meta-whatsapp-webhook`.

