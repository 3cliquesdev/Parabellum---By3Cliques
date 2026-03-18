

# Exibir conteúdo do template para mensagens antigas

## Problema
Mensagens enviadas antes da atualização foram salvas como `[Template: comercial]` sem o body_text no conteúdo nem no metadata. O fallback atual (`metadata?.template_body`) não encontra nada porque o metadata dessas mensagens antigas não tem esse campo.

## Solução

### 1. `MessageBubble.tsx` — Buscar template do banco quando não há body
Quando detectar `[Template: nome]` sem body no content e sem `metadata.template_body`:
- Extrair o nome do template (ex: "comercial")
- Fazer query na tabela `whatsapp_message_templates` por nome para buscar o `description` / `body_text`
- Exibir o texto encontrado como corpo do template

### 2. Criar hook `useTemplateContent.ts`
- Hook simples que recebe o nome do template
- Busca `description` e `body_text` da tabela `whatsapp_message_templates` filtrado por `name`
- Cache de 10min (templates raramente mudam)
- Retorna o texto do body

### 3. Integrar no `MessageBubble`
- Quando `isTemplate` e não tem bodyLines nem metadata.template_body, chamar o hook com o nome extraído
- Renderizar o resultado como corpo do template

### Arquivos a alterar
- Novo: `src/hooks/useTemplateContent.ts`
- `src/components/inbox/MessageBubble.tsx` — usar o hook para fallback

