

# Unificar Todos os Remetentes para contato@mail.3cliques.net

## Resumo

Trocar **todos** os enderecos de email `@parabellum.work` (e variacoes como `@seuarmazemdrop.parabellum.work`) para `contato@mail.3cliques.net` em todas as Edge Functions e no frontend. Isso garante que todos os emails saiam do dominio verificado, reduzindo drasticamente o risco de spam.

## Arquivos e mudancas

### Edge Functions (11 arquivos)

| Arquivo | De | Para |
|---------|-----|------|
| `send-email/index.ts` | `contato@parabellum.work` | `contato@mail.3cliques.net` |
| `send-ticket-email-reply/index.ts` | `suporte@parabellum.work` | `contato@mail.3cliques.net` |
| `send-quote-email/index.ts` | `comercial@parabellum.work` | `contato@mail.3cliques.net` |
| `send-ticket-notification/index.ts` | `contato@seuarmazemdrop.parabellum.work` | `contato@mail.3cliques.net` |
| `get-email-template/index.ts` | `contato@parabellum.work` | `contato@mail.3cliques.net` |
| `send-triggered-email/index.ts` | `contato@parabellum.work` | `contato@mail.3cliques.net` |
| `send-scheduled-reports/index.ts` | `sistema@parabellum.work` | `contato@mail.3cliques.net` |
| `send-verification-code/index.ts` | `contato@seuarmazemdrop.parabellum.work` e `sistema@seuarmazemdrop.parabellum.work` | `contato@mail.3cliques.net` |
| `resend-welcome-email/index.ts` | `contato@seuarmazemdrop.parabellum.work` | `contato@mail.3cliques.net` |
| `test-email-send/index.ts` | `noreply@parabellum.work` | `contato@mail.3cliques.net` |
| `create-user/index.ts` | `sistema@parabellum.work` + links `parabellum.work` | `contato@mail.3cliques.net` + links atualizados |

### Edge Function de Playbook (1 arquivo)

| Arquivo | Mudanca |
|---------|---------|
| `process-playbook-queue/index.ts` | Trocar prefixo `[TESTE]` para `(Teste)` no assunto — menos agressivo para filtros de spam |

### Frontend (1 arquivo)

| Arquivo | Mudanca |
|---------|---------|
| `src/components/settings/EmailSendersCard.tsx` | Trocar placeholder de `suporte@parabellum.work` para `contato@mail.3cliques.net` |

## Nomes de remetente

Todos os `from_name` hardcoded (como "PARABELLUM Security", "Seu Armazem Drop Comercial", etc.) serao unificados para `3Cliques` nos fallbacks, ja que o banco de dados (`email_senders`) e quem define o nome real. O fallback so e usado se a leitura do banco falhar.

## Impacto

- Todos os emails passam a sair de `contato@mail.3cliques.net` (dominio verificado)
- Emails de teste com prefixo mais suave `(Teste)` ao inves de `[TESTE]`
- Zero mudanca de logica de negocio
- Todas as 11 edge functions precisam redeploy

## Secao Tecnica

### Padrao de mudanca em cada arquivo

```typescript
// ANTES (exemplo)
let senderEmail = 'contato@parabellum.work';
let senderName = 'Seu Armazém Drop';

// DEPOIS
let senderEmail = 'contato@mail.3cliques.net';
let senderName = '3Cliques';
```

### Mudanca no prefixo de teste

```typescript
// ANTES
? (subject.startsWith('[TESTE]') ? subject : `[TESTE] ${subject}`)

// DEPOIS  
? (subject.startsWith('(Teste)') ? subject : `(Teste) ${subject}`)
```

### Recomendacao externa
- Confirmar no Resend (resend.com/domains) que SPF, DKIM e DMARC estao verdes para `mail.3cliques.net`
