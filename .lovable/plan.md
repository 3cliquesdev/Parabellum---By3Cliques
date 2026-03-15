

# Sistema Completo de Devoluções — 5 Entregas

## Visão Geral

Implementar sistema de devoluções com tabela dedicada, duas edge functions, interface no portal do cliente e painel administrativo.

---

## ENTREGA 1 — Migration SQL

**Tabela `returns`** com todos os campos especificados + enums como check constraints + trigger de `updated_at` + RLS policies.

| Policy | Regra |
|--------|-------|
| Admin full access | `is_manager_or_admin(auth.uid())` — SELECT/INSERT/UPDATE/DELETE |
| Cliente SELECT | `contact_id` vinculado ao email do auth user OU `registered_email` = email do auth user |
| Cliente INSERT | Mesmo critério, `created_by = 'customer'` |

A vinculação cliente↔contact será feita via lookup: o email do `auth.uid()` será cruzado com `contacts.email` para determinar o `contact_id`.

---

## ENTREGA 2 — Edge Function `register-return`

**Arquivo:** `supabase/functions/register-return/index.ts`

Recebe `{ email, external_order_id, tracking_code_return?, reason, description? }`

Fluxo:
1. Busca `contact` pelo email
2. Busca `deal` pelo `external_order_id` (cruzando com `contact_id` se encontrado)
3. Extrai `tracking_code_original` do deal
4. Verifica duplicata (mesmo `external_order_id` com `created_by = 'admin'`)
5. Se duplicata → retorna `{ duplicate: true, return_id, message }`
6. Se não → insere na tabela `returns`
7. Dispara email via `send-email` com protocolo (8 primeiros chars do UUID)
8. Retorna `{ success: true, return_id, protocol }`

**Config:** `verify_jwt = false` (validação manual no código)

---

## ENTREGA 3 — Edge Function `link-return`

**Arquivo:** `supabase/functions/link-return/index.ts`

Recebe `{ return_id, email }`

Fluxo:
1. Busca contact pelo email
2. Atualiza `returns` setando `contact_id` e `registered_email`
3. Dispara email de confirmação via `send-email`
4. Retorna `{ success: true }`

---

## ENTREGA 4 — Portal do Cliente

**Arquivo:** `src/pages/ClientPortal.tsx` — refatorar para layout com Tabs

Adicionar aba **"Devoluções"** com:
- Lista de devoluções do cliente (por `contact_id` ou `registered_email`)
- Badge colorido por status: pending=amarelo, approved=verde, rejected=vermelho, refunded=azul
- Botão "Nova Devolução" → Modal com campos: email, número do pedido, rastreio devolução (opcional), motivo (select), descrição (opcional)
- Ao submeter → chama `register-return`
- Se `duplicate: true` → alerta com opção de vincular (chama `link-return`)
- Se sucesso → mensagem com protocolo

**Novos arquivos:**
- `src/components/client-portal/ReturnsList.tsx`
- `src/components/client-portal/NewReturnDialog.tsx`
- `src/hooks/useClientReturns.ts`

---

## ENTREGA 5 — Painel Admin

**Novo arquivo:** `src/components/support/ReturnsManagement.tsx`

Integrar na página `Support.tsx` ou criar rota `/returns` acessível ao admin:
- Tabela com todas as devoluções
- Colunas: Protocolo, Cliente, Pedido, Status, Motivo, Data, Criado por
- Filtro por status
- Botão "Nova Devolução" (admin, sem email obrigatório)
- Clique na linha → detalhes + poder alterar status
- Modal admin: Pedido, Rastreio, Motivo, Descrição, Status

**Novos arquivos:**
- `src/components/support/ReturnsManagement.tsx`
- `src/components/support/AdminReturnDialog.tsx`
- `src/components/support/ReturnDetailsDialog.tsx`
- `src/hooks/useReturns.ts`

---

## Resumo de Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL (tabela `returns`) | Criar via migration tool |
| `supabase/functions/register-return/index.ts` | Criar |
| `supabase/functions/link-return/index.ts` | Criar |
| `supabase/config.toml` | Adicionar config das 2 functions |
| `src/pages/ClientPortal.tsx` | Refatorar com Tabs |
| `src/components/client-portal/ReturnsList.tsx` | Criar |
| `src/components/client-portal/NewReturnDialog.tsx` | Criar |
| `src/hooks/useClientReturns.ts` | Criar |
| `src/components/support/ReturnsManagement.tsx` | Criar |
| `src/components/support/AdminReturnDialog.tsx` | Criar |
| `src/components/support/ReturnDetailsDialog.tsx` | Criar |
| `src/hooks/useReturns.ts` | Criar |
| `src/App.tsx` | Adicionar rota `/returns` (se separada) |

