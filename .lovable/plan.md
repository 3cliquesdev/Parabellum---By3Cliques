

# Bug: Mensagens duplicadas do cliente — Falta deduplicação no webhook

## Diagnóstico

Conversa `546dbd82` (screenshot): 5x "Só mesmo!" — gap de **3.7 segundos** entre duas delas indica webhook retry duplicado.

**Causa raiz**: O `meta-whatsapp-webhook` (linha 630) insere mensagens **sem armazenar ou verificar o `msg.id` do WhatsApp** (o ID único de cada mensagem na API Meta). Campos `provider_message_id`, `external_id` e `metadata` ficam todos `NULL`.

Quando a Meta reenvia o webhook (retry automático por timeout ou erro transitório), a mesma mensagem é inserida novamente sem nenhuma proteção.

## Correções

### 1. Armazenar `msg.id` no insert (meta-whatsapp-webhook, linha ~630)
Adicionar `provider_message_id: msg.id` no insert de mensagens de contato.

### 2. Dedup check antes do insert
Antes de inserir, verificar se já existe mensagem com aquele `provider_message_id`:
```
SELECT id FROM messages WHERE provider_message_id = msg.id LIMIT 1
```
Se existir, skip silenciosamente (log + continue).

### 3. Unique index parcial no banco
Criar índice parcial para proteção a nível de banco:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_provider_message_id_unique 
ON messages (provider_message_id) 
WHERE provider_message_id IS NOT NULL;
```
Isso garante idempotência mesmo em race conditions entre webhooks concorrentes.

### 4. Deploy
Deploy da `meta-whatsapp-webhook` após as alterações.

### Arquivos afetados
- `supabase/functions/meta-whatsapp-webhook/index.ts` — insert de mensagem + dedup check
- Migration SQL — unique index parcial

### Impacto
- Elimina duplicação de mensagens de contato vindas do WhatsApp Meta
- Zero impacto em mensagens existentes (index é parcial, ignora NULLs)

