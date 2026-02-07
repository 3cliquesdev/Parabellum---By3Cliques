
# Correção: Email do Playbook Duplicando Header/Footer

## Problema Identificado

O email chegou com **header e footer duplicados** porque:

1. O template é salvo no banco com **seu próprio layout HTML completo** (header "SEUARMAZÉMDROP", footer, etc.)
2. Quando o `process-playbook-queue` envia esse template para `send-email`, **não passa `useRawHtml: true`**
3. O `send-email` então aplica **OUTRO** wrapper de branding, resultando em:
   - Header do branding do sistema
   - Conteúdo do template (que já tem SEU header e footer)
   - Footer do branding do sistema

## Solução

Modificar o `process-playbook-queue` para passar `useRawHtml: true` quando estiver enviando um template personalizado. Isso fará com que o `send-email` use o HTML exatamente como está, sem adicionar wrapper extra.

### Arquivo a Modificar

`supabase/functions/process-playbook-queue/index.ts`

**Localização:** Função `executeEmailNode`, na chamada do `send-email` (linhas 513-524)

**Mudança:**
- Adicionar `useRawHtml: !!emailData.template_id` ao payload
- Quando há `template_id`, o template já tem layout próprio → usar raw HTML
- Quando não há `template_id` (fallback body/message), manter branding padrão

```text
Antes (linhas 513-524):
const { data, error } = await supabase.functions.invoke('send-email', {
  body: {
    to: to,
    to_name: to_name,
    subject: finalSubject,
    html: finalHtml,
    customer_id: contact.id,
    ...
  },
});

Depois:
const { data, error } = await supabase.functions.invoke('send-email', {
  body: {
    to: to,
    to_name: to_name,
    subject: finalSubject,
    html: finalHtml,
    customer_id: contact.id,
    useRawHtml: !!emailData.template_id,  // Template personalizado = usar HTML como está
    ...
  },
});
```

## Impacto

| Aspecto | Avaliação |
|---------|-----------|
| Regressão | Nenhuma - templates personalizados renderizarão corretamente |
| Funcionalidade | Emails de playbook com template respeitam o layout do template |
| Fallback | Emails sem template continuam recebendo branding padrão |

## Teste Esperado Após Correção

1. Email de teste deve chegar com layout limpo (só o template)
2. Banner de teste aparece dentro do template
3. Sem duplicação de header/footer
