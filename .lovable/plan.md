

# Plano Ajustado: Configuração Admin de Emails ao Cliente

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Resumo

Permitir que o admin controle quais eventos geram email para o cliente via 3 toggles na página de Mensagens da IA (`/settings/ai-messages`). Inclui helper reutilizável, cache na Edge Function e segurança via RLS.

## Detalhes Técnicos

### 1. Seed das 3 configs (insert via ferramenta de dados)

Inserir na tabela `system_configurations` com `upsert` por `key`:

| key | value | category | description |
|---|---|---|---|
| `ticket_email_customer_created` | `true` | `ticket_email` | Email ao cliente na criação do ticket |
| `ticket_email_customer_resolved` | `true` | `ticket_email` | Email ao cliente na resolução do ticket |
| `ticket_email_customer_comment` | `true` | `ticket_email` | Email ao cliente em comentário público |

Valor `string` — `"true"` / `"false"` — compatível com o schema existente (`value: string`).

### 2. Helper `useTicketEmailConfig` (novo hook)

Criar `src/hooks/useTicketEmailConfig.tsx`:

- **Query única**: busca as 3 keys com `.in('key', [...])` 
- **parseBool helper** interno: converte `"true"` → `true`, default `true` se não encontrado
- **Mutation genérica**: recebe `{ key, enabled }`, faz `upsert` na `system_configurations`
- **queryKey**: `['ticket-email-config']` com `staleTime: 30000`
- Exporta `{ config, isLoading, toggleConfig }` onde config é `{ created: boolean, resolved: boolean, comment: boolean }`

Isso evita queries repetidas na UI e no `useCreateComment`.

### 3. `src/pages/AIMessagesSettings.tsx` — Card de notificações

Adicionar **antes dos filtros** (entre o header e a barra de busca) um card com:

- Título: "Notificações por Email ao Cliente"
- Descrição: "Controle quais eventos enviam email automático para o cliente"
- 3 switches com labels:
  - "Ticket criado" → `ticket_email_customer_created`
  - "Ticket resolvido" → `ticket_email_customer_resolved`  
  - "Comentário público" → `ticket_email_customer_comment`
- Loading skeleton enquanto carrega
- Toast "Configuração salva" ao alterar
- **Guarda de permissão**: só exibe o card se `hasFullAccess(role)` for `true`

### 4. `supabase/functions/notify-ticket-event/index.ts` — Cache + consulta dinâmica

Antes do bloco de email ao cliente (linha ~465):

```text
// Cache in-memory com TTL 60s (similar ao ai-config-cache.ts)
let emailConfigCache = { value: null, expiresAt: 0 }

async function getTicketEmailConfig(supabase):
  if cache válido: return cache
  buscar 3 keys com .in('key', [...])
  parseBool cada uma (default true)
  cachear por 60s
  return { created, resolved, comment }
```

Construir `customerEmailEvents` dinamicamente:
```text
const cfg = await getTicketEmailConfig(supabase)
const customerEmailEvents = []
if (cfg.created) customerEmailEvents.push('created')
if (cfg.resolved) customerEmailEvents.push('resolved')
// 'closed' removido definitivamente
```

### 5. `src/hooks/useCreateComment.tsx` — Respeitar config

Antes de invocar `send-ticket-email-reply`:

1. Buscar `ticket_email_customer_comment` da `system_configurations` (query simples, pode usar cache do React Query)
2. Se `"false"`: return sem enviar
3. Se `"true"` ou não encontrado: enviar normalmente

Implementação: query inline com `.maybeSingle()` — leve e isolada do fluxo principal.

### 6. Segurança — RLS

A tabela `system_configurations` já tem política de **SELECT aberta** para autenticados (conforme memória do projeto). Para **UPDATE/INSERT**, verificar se existe política restrita a admins/managers. Se não existir, criar migration:

```sql
CREATE POLICY "Only managers can update system_configurations"
ON public.system_configurations
FOR UPDATE
TO authenticated
USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Only managers can insert system_configurations"
ON public.system_configurations
FOR INSERT
TO authenticated
WITH CHECK (public.is_manager_or_admin(auth.uid()));
```

Isso garante que mesmo sem a UI, o banco barra alterações de não-admins.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `system_configurations` (dados) | Upsert 3 registros de configuração |
| `src/hooks/useTicketEmailConfig.tsx` | **Novo** — helper com query única + parseBool + mutation |
| `src/pages/AIMessagesSettings.tsx` | Card com 3 switches (guarded por `hasFullAccess`) |
| `supabase/functions/notify-ticket-event/index.ts` | Cache 60s + construção dinâmica de `customerEmailEvents` |
| `src/hooks/useCreateComment.tsx` | Consultar config antes de enviar email de comentário |
| Migration SQL (se necessário) | RLS policies de UPDATE/INSERT para `system_configurations` |

## Critérios de aceite

| Critério | Cobertura |
|---|---|
| Admin vê 3 toggles em /settings/ai-messages | Card com switches |
| Desligar "Ticket criado" → criar ticket não manda email | Edge function consulta config |
| Desligar "Ticket resolvido" → resolver não manda email | Edge function consulta config |
| Desligar "Comentário público" → comentário não manda email | useCreateComment consulta config |
| Defaults = true (sem mudança para quem não mexer) | parseBool com fallback true |
| Não-admin não altera config (UI + banco) | hasFullAccess guard + RLS policies |
| 1 query por leitura (não 3 separadas) | `.in('key', [...])` no helper |
| Edge function não faz query a cada request | Cache in-memory 60s |

## Impacto

- Zero regressão: defaults mantêm comportamento atual
- Upgrade: controle granular para admin sobre emails ao cliente
- Performance: cache na Edge Function, query única na UI
- Segurança: RLS + guard de role na interface

