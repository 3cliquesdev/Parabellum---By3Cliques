

# Auditoria 100% — ChatFlow Soberano para TODO o Inbox (Fase Final)

## Estado Atual (Já Resolvido)
- ✅ Department UUIDs centralizados via `department-resolver.ts` em 7 functions
- ✅ Pipeline/Stage dinâmicos no `ai-autopilot-chat` e `ai-governor`
- ✅ Tags dinâmicas no `auto-close-conversations`
- ✅ Persona dinâmica, templates via fluxo, TRANSFER_LABELS dinâmico

## Problemas Residuais Encontrados

### 🔴 P1 — Branding "3Cliques" / "contato@mail.3cliques.net" hardcoded em 14 edge functions

O banco já tem tabelas `email_branding` e `email_senders` com os valores configuráveis, mas **14 functions ignoram essas tabelas** e usam fallbacks estáticos:

| Função | Ocorrências |
|--------|-------------|
| `send-verification-code` | Nome, email, subject, logo — tudo hardcoded |
| `send-ticket-email-reply` | `fromName`, `fromEmail`, `brandName` |
| `notify-ticket-event` | `brandName`, `fromName`, `fromEmail`, `footerText` |
| `send-ticket-notification` | `senderEmail`, `senderName` |
| `send-email` | `senderEmail` |
| `send-triggered-email` | `fromName`, `fromEmail`, `brandName` |
| `send-scheduled-reports` | from hardcoded |
| `send-quote-email` | from hardcoded |
| `create-user` | from hardcoded, HTML de email fixo |
| `resend-welcome-email` | from hardcoded, HTML com "PARABELLUM | 3Cliques" |
| `test-email-send` | fallback hardcoded |
| `get-email-template` | `fromName`, `fromEmail` fallbacks |
| `ai-governor` | `brandName`, `fromEmail` fallbacks |
| `meta-whatsapp-webhook` | Fallback greeting "Sou a assistente virtual da 3Cliques" (L1211, L1233) |

**Impacto:** Se a organização mudar de nome ou email, 14 functions continuam enviando com a marca antiga.

### 🔴 P2 — Fallback greeting hardcoded no webhook (L1211, L1233)

```
"Olá! Sou a assistente virtual da 3Cliques. Posso te ajudar com informações financeiras, saques, reembolsos e dúvidas gerais."
```

Essa mensagem deveria vir da persona configurada no fluxo ativo ou ser genérica.

### 🟡 P3 — `PORTAL_PERSONA_ID` hardcoded no frontend (`useClientAssistant.ts`)

UUID fixo `d4dc2026-...` para a persona do portal do cliente. Se trocar a persona, o portal quebra.

### 🟡 P4 — `contextPrompt` hardcoded no frontend (`useClientAssistant.ts`)

Texto fixo: "Você é a assistente virtual do portal do cliente da 3Cliques". Deveria vir da persona configurada.

### 🟡 P5 — `DEFAULT_MESSAGE` no `BroadcastAIQueueDialog.tsx`

Mensagem de broadcast fixa: "Sou a assistente virtual da 3Cliques". Deveria usar o nome da organização ou persona.

### 🟢 P6 — Frontend placeholders/alt text ("Seu Armazém Drop")

`SetupPassword.tsx`, `PublicOnboarding.tsx`, `EmailSendersCard.tsx`, `EmailBrandingCard.tsx` — são placeholders de formulário e alt text de logo. **Baixa prioridade** mas quebram a neutralidade.

### 🟢 P7 — `CS_NOVOS_PIPELINE_ID` e `ONBOARDING_PLAYBOOK_ID` no frontend

UUIDs fixos em hooks de métricas. São dashboards analíticos específicos, não roteamento. **Não alterar** nesta fase.

---

## Plano de Correção (foco inbox + emails)

### Correção 1 — Criar helper `_shared/branding-resolver.ts`

Módulo compartilhado que busca branding e sender do banco UMA vez:

```typescript
export async function resolveBranding(supabase: any) {
  const [{ data: branding }, { data: sender }, { data: org }] = await Promise.all([
    supabase.from('email_branding').select('*').limit(1).maybeSingle(),
    supabase.from('email_senders').select('*').eq('is_default', true).maybeSingle(),
    supabase.from('organizations').select('name').limit(1).maybeSingle(),
  ]);
  return {
    brandName: branding?.name || org?.name || 'Sua Empresa',
    fromName: sender?.from_name || branding?.name || 'Suporte',
    fromEmail: sender?.from_email || 'contato@example.com',
    headerColor: branding?.header_color || '#0f172a',
    footerText: branding?.footer_text || '',
    logoUrl: branding?.logo_url || '',
  };
}
```

### Correção 2 — Atualizar 12 edge functions de email

Substituir todos os fallbacks "3Cliques" / "contato@mail.3cliques.net" pelo `resolveBranding()`. Functions afetadas:
- `send-verification-code`, `send-ticket-email-reply`, `notify-ticket-event`, `send-ticket-notification`, `send-email`, `send-triggered-email`, `send-scheduled-reports`, `send-quote-email`, `create-user`, `resend-welcome-email`, `test-email-send`, `get-email-template`

Cada function ganha uma chamada `const brand = await resolveBranding(supabase)` e substitui os literais por `brand.fromName`, `brand.fromEmail`, etc.

### Correção 3 — Fallback greeting dinâmico no `meta-whatsapp-webhook`

Substituir a string fixa "Sou a assistente virtual da 3Cliques" por uma busca à persona do fluxo ativo ou ao nome da organização:

```typescript
const orgName = org?.name || 'nossa equipe';
const fallbackGreeting = `Olá! Sou a assistente virtual da ${orgName}. Como posso te ajudar? 😊`;
```

### Correção 4 — `useClientAssistant.ts` — buscar persona por slug

Substituir `PORTAL_PERSONA_ID` hardcoded por uma query que busca a persona "portal" por nome/slug:

```typescript
const { data: portalPersona } = await supabase
  .from('ai_personas').select('id, system_prompt')
  .eq('name', 'Portal Cliente').maybeSingle();
```

E remover o `contextPrompt` hardcoded, delegando ao `system_prompt` da persona.

### Correção 5 — `BroadcastAIQueueDialog.tsx` — mensagem dinâmica

Buscar nome da organização para montar `DEFAULT_MESSAGE` dinâmica.

### Correção 6 — Frontend alt text / placeholders

Substituir "Seu Armazém Drop" por texto genérico ou busca à organização em `SetupPassword.tsx` e `PublicOnboarding.tsx`.

---

## Arquivos Afetados

| Arquivo | Tipo |
|---------|------|
| `_shared/branding-resolver.ts` | **NOVO** |
| 12 edge functions de email | Substituir fallbacks por `resolveBranding()` |
| `meta-whatsapp-webhook/index.ts` | Fallback greeting dinâmico |
| `src/hooks/useClientAssistant.ts` | Persona por slug |
| `src/components/inbox/BroadcastAIQueueDialog.tsx` | Mensagem dinâmica |
| `src/pages/SetupPassword.tsx` | Alt text genérico |
| `src/pages/PublicOnboarding.tsx` | Alt text genérico |

## O que NÃO alterar
- Workspace IDs `00000000-...` — infraestrutura single-tenant
- `CS_NOVOS_PIPELINE_ID`, `ONBOARDING_PLAYBOOK_ID` — dashboards analíticos
- `kiwify_events`, `kiwify_validated` — schema real
- `kiwifyProductMapping.ts` — mapeamento de produto funcional
- `GlobalFilters.tsx` "3cliques" — é um valor de filtro analítico, não branding

**Estimativa:** 1 novo arquivo, ~14 edge functions editadas, 3 frontend editados, ~15 deploys

