
# Corrigir Entrega de OTP para Emails Corporativos

## Diagnostico

O codigo OTP esta sendo gerado e salvo corretamente no banco (varios registros para `atendimentobabado@babadotop.com.br`, todos `verified: false`). A API do Resend aceita o envio (retorna `success: true`), mas o email nao esta chegando ao destinatario.

**Causa provavel**: O servidor de email do dominio `babadotop.com.br` esta rejeitando ou filtrando o email enviado de `contato@mail.3cliques.net`. Isso e comum em dominios corporativos com filtros anti-spam mais rigorosos.

## Solucoes Propostas

### 1. Melhorar a Edge Function `send-verification-code`

**Arquivo**: `supabase/functions/send-verification-code/index.ts`

- Adicionar logging do `resend_email_id` retornado para rastreamento
- Adicionar headers `Reply-To` e `List-Unsubscribe` para melhorar deliverability
- Reduzir conteudo HTML (emails longos com muitas tabelas sao mais propensos a filtros de spam)
- Simplificar o template para emails de verificacao (quanto mais limpo, menos chance de spam)

### 2. Adicionar feedback visual na interface

**Arquivo**: `src/components/OTPVerificationModal.tsx` (e equivalente no webchat se houver)

- Adicionar dica visual: "Verifique sua caixa de spam/lixo eletronico"
- Adicionar texto informativo sobre emails corporativos que podem bloquear

### 3. Adicionar fallback: registro na tabela `email_sends` para tracking

**Arquivo**: `supabase/functions/send-verification-code/index.ts`

- Apos enviar via Resend, registrar o `resend_email_id` na tabela para que o webhook de tracking (resend-webhook) consiga reportar bounces
- Isso permite detectar automaticamente quando o email nao foi entregue

## Detalhes Tecnicos

### Edge Function - Melhorias de deliverability

```typescript
// Adicionar headers para melhorar deliverability
const { data: emailData, error: emailError } = await resend.emails.send({
  from: branding.from,
  to: [email],
  subject: branding.subject,
  headers: {
    'X-Entity-Ref-ID': verificationId, // Evita agrupamento
  },
  html: templateSimplificado, // Template mais enxuto
});

// Logar resend_email_id para debug
console.log('[send-verification-code] Resend ID:', emailData?.id);
```

### Modal OTP - Feedback visual

Adicionar apos o Alert de "Enviamos um codigo":

```text
Nao recebeu? Verifique a pasta de spam ou lixo eletronico.
Emails corporativos podem ter filtros mais rigorosos.
```

### Registro em email_sends para tracking

```typescript
// Apos envio bem-sucedido, registrar para tracking de bounces
if (emailData?.id) {
  await supabase.from('email_sends').insert({
    resend_email_id: emailData.id,
    recipient_email: email,
    subject: branding.subject,
    status: 'sent',
    sent_at: new Date().toISOString(),
  });
}
```

## Arquivos Modificados

1. `supabase/functions/send-verification-code/index.ts` - Melhorar deliverability e registrar envio
2. `src/components/OTPVerificationModal.tsx` - Adicionar feedback sobre spam

## Zero Regressao

- Fluxo de verificacao continua funcionando igual
- Codigo OTP gerado da mesma forma
- Apenas melhora o template e adiciona tracking
- Nenhuma mudanca em verify-code ou outros fluxos
