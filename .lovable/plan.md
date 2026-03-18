

# Mostrar texto do template nas mensagens

## Problema
Mensagens de template aparecem como `[Template: nome_template]` ou com o erro "Message undeliverable (131026)" sem mostrar o conteúdo real do template.

## Causa raiz
1. A tabela `whatsapp_message_templates` não tem campo com o texto do corpo (body) do template
2. A edge function `send-meta-whatsapp` salva o conteúdo como `[Template: nome]` (linha 445)
3. O `MessageBubble` renderiza esse texto genérico sem formatação especial

## Solução

### 1. Adicionar coluna `body_text` na tabela de templates (migration SQL)
```sql
ALTER TABLE whatsapp_message_templates ADD COLUMN body_text text;
```
Isso permite armazenar o texto real do template quando ele é cadastrado/sincronizado.

### 2. Atualizar edge function `send-meta-whatsapp`
Na linha 444-445, quando salva a mensagem de template no banco, incluir o `body_text` se fornecido no payload:
- Aceitar campo `template.body_text` no payload
- Salvar como conteúdo da mensagem em vez de `[Template: nome]`
- Formato: `📋 *Template: nome*\n\ntexto do template`
- Salvar `template_name` e `template_body` no metadata para referência

### 3. Atualizar `ReengageTemplateDialog.tsx` e `PipelineTemplateDialog.tsx`
- Passar `body_text` do template selecionado no payload para a edge function
- `template.body_text = selectedTemplate.description || selectedTemplate.name`

### 4. Melhorar renderização no `MessageBubble`
- Detectar mensagens que começam com `[Template:` e renderizar com estilo visual diferenciado (badge de template + texto do description se disponível no metadata)
- Para mensagens futuras que já terão o body_text, renderizar normalmente

### 5. Backfill templates existentes
Query para preencher `body_text` a partir do `description` onde disponível:
```sql
UPDATE whatsapp_message_templates 
SET body_text = description 
WHERE body_text IS NULL AND description IS NOT NULL;
```

### Arquivos a alterar
- `supabase/functions/send-meta-whatsapp/index.ts` — aceitar e salvar body_text
- `src/components/inbox/ReengageTemplateDialog.tsx` — enviar body_text
- `src/components/pipeline/PipelineTemplateDialog.tsx` — enviar body_text
- `src/components/inbox/MessageBubble.tsx` — estilo visual para templates
- 1 migration SQL (add column + backfill)

