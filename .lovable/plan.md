
# Plano: Corrigir Preview V2 + Completar Tracking de Emails

## Resumo das Correções

### Parte 1: Preview V2 (4 correções)

### Parte 2: Webhook Tracking (atualizar `email_sends`)

---

## Parte 1: Correções no Preview V2

### 1.1 PreviewPanel.tsx - Detectar Template Migrado

**Arquivo:** `src/components/email-builder-v2/PreviewPanel.tsx`

**Linha 55-58 (substituir):**

```typescript
const generatedHtml = useMemo(() => {
  const safeBlocks = Array.isArray(blocks) ? blocks : [];

  // Detectar template migrado (HTML completo em bloco único)
  if (safeBlocks.length === 1 && safeBlocks[0]?.block_type === "html") {
    const htmlContent =
      safeBlocks[0]?.content?.html ||
      safeBlocks[0]?.content?.value ||
      "";

    const s = htmlContent.trimStart().toLowerCase();
    const isFullDocument = s.startsWith("<!doctype") || s.startsWith("<html");

    if (isFullDocument) {
      // Template migrado - renderizar direto
      return replaceVariables(htmlContent, sampleData);
    }
  }

  // Fluxo normal para templates V2 nativos
  const rawHtml = generateEmailHTML(safeBlocks, { preheader, subject });
  return replaceVariables(rawHtml, sampleData);
}, [blocks, preheader, subject, sampleData]);
```

---

### 1.2 emailHtmlGenerator.ts - Fallback para Blocos Vazios (SEM EMOJI)

**Arquivo:** `src/utils/emailHtmlGenerator.ts`

**Inserir após linha 426 (dentro da função `generateEmailHTML`):**

```typescript
export function generateEmailHTML(
  blocks: EmailBlock[],
  options: GenerateOptions = {}
): string {
  const { branding, preheader, subject } = options;

  // Fallback para preview vazio (sem emojis - padrão visual Octadesk)
  if (!blocks || blocks.length === 0) {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
</head>
<body style="margin: 0; padding: 40px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="text-align: center; color: #64748b; padding: 60px 20px;">
    <h2 style="margin: 0 0 8px 0; color: #334155;">Nenhum bloco adicionado</h2>
    <p style="margin: 0; font-size: 14px;">Arraste blocos da barra lateral para montar seu email.</p>
  </div>
</body>
</html>
    `.trim();
  }

  // ... resto do código existente
```

---

### 1.3 emailHtmlGenerator.ts - Safe Access para Styles em TODAS as Funções

**Padrão a aplicar em cada função `generate*BlockHtml`:**

```typescript
// ANTES (linha 70):
const padding = parsePadding(block.styles.padding);

// DEPOIS:
const styles = block.styles ?? {};
const content = block.content ?? {};
const padding = parsePadding(styles.padding);
```

**Funções a modificar (10 no total):**

| Função | Linha | Campos a proteger |
|--------|-------|-------------------|
| `generateTextBlockHtml` | 69 | `styles.padding`, `styles.textAlign`, `styles.fontSize`, `styles.color`, `styles.backgroundColor` |
| `generateImageBlockHtml` | 90 | `styles.padding`, `styles.textAlign`, `styles.borderRadius`, `styles.backgroundColor` |
| `generateButtonBlockHtml` | 145 | `styles.padding`, `styles.textAlign`, `styles.backgroundColor`, `styles.color`, `styles.borderRadius`, `styles.fontSize`, `styles.fontWeight` |
| `generateSpacerBlockHtml` | 192 | `content.height`, `styles.backgroundColor` |
| `generateDividerBlockHtml` | 208 | `styles.padding`, `styles.color` |
| `generateBannerBlockHtml` | 224 | `styles.padding`, `styles.backgroundColor`, `styles.color`, `styles.textAlign` |
| `generateSignatureBlockHtml` | 251 | `styles.padding`, `styles.textAlign`, `styles.color`, `styles.backgroundColor` |
| `generateSocialBlockHtml` | 282 | `styles.padding`, `styles.textAlign`, `styles.backgroundColor` |
| `generateHtmlBlockHtml` | 350 | `styles.padding`, `styles.backgroundColor` |
| `generateColumnsBlockHtml` | 366 | `styles.padding`, `styles.backgroundColor` |

---

### 1.4 emailHtmlGenerator.ts - Normalizar buttonText (Linha 179)

**Antes:**
```typescript
${block.content.buttonText || "Clique aqui"}
```

**Depois:**
```typescript
${content.buttonText || content.text || "Clique aqui"}
```

---

## Parte 2: Webhook - Atualizar `email_sends`

### Situação Atual

- Tabela `email_sends` **já possui** os campos: `opened_at`, `clicked_at`, `bounced_at`, `sent_at`
- Tabela `email_sends` **já possui** campo `resend_email_id` (mas sem índice único)
- Webhook `email-webhook` **só insere em `interactions`** - não atualiza `email_sends`

### 2.1 Criar Índice Único (Migration)

```sql
CREATE UNIQUE INDEX IF NOT EXISTS email_sends_resend_email_id_uidx 
  ON public.email_sends(resend_email_id) 
  WHERE resend_email_id IS NOT NULL;
```

---

### 2.2 Atualizar Webhook `email-webhook/index.ts`

**Modificações:**

1. Processar **todos** os eventos relevantes (não só opened/clicked)
2. Atualizar `email_sends` além de criar interações
3. Fazer update idempotente (usar `MIN` para timestamps)

**Arquivo:** `supabase/functions/email-webhook/index.ts`

**Adicionar após a inserção de interação (linha 190):**

```typescript
// Atualizar email_sends para consulta rápida
const updateField = eventType === 'email.opened' 
  ? 'opened_at' 
  : eventType === 'email.clicked'
    ? 'clicked_at'
    : eventType === 'email.bounced'
      ? 'bounced_at'
      : eventType === 'email.delivered'
        ? 'delivered_at'
        : null;

if (updateField) {
  // Usar COALESCE para manter o primeiro timestamp (idempotência)
  const { error: updateError } = await supabase
    .from('email_sends')
    .update({ [updateField]: payload.created_at })
    .eq('resend_email_id', emailId)
    .is(updateField, null); // Só atualiza se ainda estiver NULL

  if (updateError) {
    console.warn('[email-webhook] Warning: Failed to update email_sends:', updateError);
  } else {
    console.log('[email-webhook] email_sends updated:', updateField);
  }
}
```

**Também modificar linha 114-124 para processar mais eventos:**

```typescript
// ANTES:
if (eventType !== 'email.opened' && eventType !== 'email.clicked') {

// DEPOIS:
const TRACKED_EVENTS = ['email.opened', 'email.clicked', 'email.bounced', 'email.delivered'];
if (!TRACKED_EVENTS.includes(eventType)) {
```

---

### 2.3 Atualizar `send-email/index.ts` - Salvar em `email_sends`

**Adicionar após linha 252 (após `resendData`):**

```typescript
// Registrar em email_sends para tracking completo
if (customer_id && !isTest) {
  const { error: sendError } = await supabase
    .from('email_sends')
    .insert({
      contact_id: customer_id,
      resend_email_id: resendData.id,
      subject,
      recipient_email: to,
      status: 'sent',
      sent_at: new Date().toISOString(),
      variables_used: { to_name: recipientName, branding: brandName }
    });

  if (sendError) {
    console.warn('[send-email] Warning: Failed to insert email_sends:', sendError);
  }
}
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/email-builder-v2/PreviewPanel.tsx` | Detectar e renderizar HTML migrado |
| `src/utils/emailHtmlGenerator.ts` | Fallback vazio + safe access + buttonText |
| `supabase/functions/email-webhook/index.ts` | Atualizar `email_sends` + mais eventos |
| `supabase/functions/send-email/index.ts` | Inserir em `email_sends` ao enviar |
| **Migration SQL** | Índice único em `resend_email_id` |

---

## Fluxo Final de Tracking

```text
1. Envia email (send-email ou send-triggered-email)
   → Grava em email_sends: resend_email_id, contact_id, sent_at
   → Grava em email_tracking_events: event_type='sent'
   → Grava em interactions: type='email_sent'

2. Resend dispara webhook (delivered/opened/clicked/bounced)
   → email-webhook recebe
   → Atualiza email_sends: opened_at, clicked_at, etc.
   → Grava em email_tracking_events
   → Grava em interactions

3. Consulta no onboarding/playbook:
   SELECT opened_at, clicked_at FROM email_sends 
   WHERE contact_id = :id ORDER BY sent_at DESC
```

---

## Consultas Úteis para Playbook/Onboarding

```sql
-- Cliente abriu o email?
SELECT opened_at IS NOT NULL AS abriu
FROM email_sends 
WHERE contact_id = :contact_id 
ORDER BY sent_at DESC LIMIT 1;

-- Cliente clicou?
SELECT clicked_at IS NOT NULL AS clicou
FROM email_sends 
WHERE contact_id = :contact_id 
ORDER BY sent_at DESC LIMIT 1;

-- Histórico completo
SELECT subject, sent_at, opened_at, clicked_at, bounced_at
FROM email_sends 
WHERE contact_id = :contact_id 
ORDER BY sent_at DESC;
```

---

## Testes Necessários

1. Abrir template V2 criado do zero - verificar preview
2. Abrir template migrado do V1 - verificar preview (HTML completo)
3. Criar template novo sem blocos - verificar mensagem placeholder
4. Enviar email de teste e verificar se grava em `email_sends`
5. Simular webhook `opened` e verificar se atualiza `opened_at`
