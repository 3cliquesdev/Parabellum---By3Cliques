

## Plano: Corrigir Erro "profiles.email does not exist"

### Problema Identificado

A edge function `send-admin-alert` está falhando porque tenta acessar uma coluna `email` na tabela `profiles`, mas essa coluna **não existe**. Os emails dos usuários estão armazenados na tabela `auth.users`, que é gerenciada pelo sistema de autenticação.

**Erro no log do banco:**
```
ERROR: column profiles.email does not exist
```

**Código problemático (linha 31):**
```typescript
.select('user_id, profiles!inner(email, full_name)')
```

### Impacto

Esta função é chamada por várias edge functions críticas:
- `ai-autopilot-chat` - quando a IA falha
- `handle-whatsapp-event` - quando WhatsApp desconecta
- `check-whatsapp-status` - verificação de status do WhatsApp

Quando qualquer uma dessas situações ocorre, o erro se propaga e pode afetar a experiência do usuário.

### Solução

Modificar a edge function `send-admin-alert` para buscar o email dos administradores corretamente usando a API Admin do Supabase Auth.

**Arquivo a modificar:** `supabase/functions/send-admin-alert/index.ts`

**Lógica corrigida:**

```typescript
// 1. Buscar user_ids dos admins
const { data: adminRoles, error: rolesError } = await supabaseClient
  .from('user_roles')
  .select('user_id, profiles!inner(full_name)')
  .eq('role', 'admin');

// 2. Para cada admin, buscar email via Auth Admin API
for (const adminRole of adminRoles) {
  const { data: { user }, error } = await supabaseClient.auth.admin.getUserById(adminRole.user_id);
  const adminEmail = user?.email;
  const adminName = adminRole.profiles.full_name;
  // ... enviar email
}
```

### Detalhes Técnicos

| Item | Antes | Depois |
|------|-------|--------|
| Query | `profiles!inner(email, full_name)` | `profiles!inner(full_name)` |
| Obter email | `admin.profiles.email` (não existe) | `auth.admin.getUserById()` |
| Client usado | Service Role | Service Role (obrigatório para admin API) |

### Benefícios

1. **Erro corrigido**: A query não falhará mais
2. **Alertas funcionando**: Admins receberão notificações de falhas da IA
3. **Estabilidade**: Outras edge functions que dependem desta também funcionarão

### Resultado Esperado

Após a correção, quando a IA falhar ou o WhatsApp desconectar, os administradores receberão emails de alerta corretamente, e os erros de banco de dados não afetarão mais a experiência dos usuários como a Thaynara.

