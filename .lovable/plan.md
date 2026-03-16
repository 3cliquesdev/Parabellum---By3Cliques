

# Separação Completa: Portal do Cliente vs Painel Admin

## Situação Atual

- **Login do cliente** já existe em `/portal` (`ClientLogin.tsx`) — visual dedicado, funcional
- **Trigger `assign_first_admin`** atribui role `user` na tabela `user_roles` para todos os novos auth users (incluindo clientes criados pelo kiwify-webhook)
- **kiwify-webhook** cria auth user com `user_metadata: { full_name, contact_id, source: 'kiwify' }` — **não inclui `role`** no metadata
- **ProtectedRoute** já verifica role via `user_roles` e permissions — mas não diferencia explicitamente "client vs internal"
- **Não existe guard** que impeça um cliente de acessar `/inbox`, `/settings` etc. se souber a URL (depende apenas de `requiredPermission` que pode falhar silenciosamente)
- **Não existe guard** que impeça um admin de acessar `/client-portal` (embora isso seja menos crítico)

## O que NÃO precisa mudar

- A tela `/portal` (ClientLogin.tsx) **já existe e está boa**
- O trigger `assign_first_admin` **já atribui `role: 'user'`** para clientes — funciona
- O `ProtectedRoute` com `requiredPermission` **já bloqueia** a maioria das rotas admin para role `user` porque `user` não tem permissões configuradas

## O que precisa mudar (3 itens)

### 1. Criar `PortalGuard` — proteção explícita do portal
**Arquivo:** `src/components/auth/PortalGuard.tsx`

Componente que:
- Verifica se o usuário está autenticado
- Verifica se `role === 'user'` (via `useUserRole`)
- Se não autenticado → redirect `/portal`
- Se role não é `user` → redirect para `ROLE_HOME_PAGES[role]`

Envolver `/client-portal` com `<PortalGuard>` em vez de `<ProtectedRoute>` genérico.

### 2. Fortalecer `ProtectedRoute` contra role `user`
**Arquivo:** `src/components/ProtectedRoute.tsx`

Adicionar verificação explícita: se `role === 'user'`, **sempre** redirecionar para `/client-portal`. Clientes nunca devem ver rotas admin, independente de `requiredPermission`.

Isso é a "Camada 2" da segurança — mesmo que um cliente tente acessar `/inbox` diretamente, será bloqueado no nível da rota.

### 3. Atualizar kiwify-webhook — adicionar `role` ao user_metadata
**Arquivo:** `supabase/functions/kiwify-webhook/index.ts`

Na chamada `createUser`, adicionar `role: 'client'` ao `user_metadata`:
```typescript
user_metadata: {
  full_name: Customer.full_name,
  contact_id: contact.id,
  source: 'kiwify',
  role: 'client'  // ← novo
}
```

Isso permite verificação rápida no frontend sem query ao banco (camada extra, não substitui `user_roles`).

### 4. Atualizar App.tsx — usar PortalGuard
**Arquivo:** `src/App.tsx`

- Rota `/client-portal` usa `<PortalGuard>` em vez de `<ProtectedRoute>`
- Manter `/portal` como rota pública (já está)

### 5. RLS das tabelas do portal (verificação)
As tabelas `returns`, `tickets`, `playbook_executions`, `customer_journey_steps` precisam ter policies SELECT que restrinjam clientes aos seus próprios dados. Verificar e corrigir se necessário via migration.

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `src/components/auth/PortalGuard.tsx` | Criar — guard de rota para portal do cliente |
| `src/components/ProtectedRoute.tsx` | Modificar — bloquear role `user` de todas as rotas admin |
| `supabase/functions/kiwify-webhook/index.ts` | Modificar — adicionar `role: 'client'` ao user_metadata |
| `src/App.tsx` | Modificar — usar PortalGuard na rota `/client-portal` |

## Fluxo final

```text
Cliente → /portal → login → role="user" → /client-portal (PortalGuard)
Cliente → /inbox → ProtectedRoute detecta role="user" → redirect /client-portal
Admin → /client-portal → PortalGuard detecta role≠"user" → redirect /
Admin → /inbox → ProtectedRoute OK → acessa normalmente
```

