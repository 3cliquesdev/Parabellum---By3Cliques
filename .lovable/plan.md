
# Correção: Edge Function test-playbook - Tabela de Roles Errada

## Problema Identificado

**Erro nos logs:**
```
"column profiles.role does not exist"
```

**Causa raiz:**
A edge function `test-playbook/index.ts` (linhas 89-93) está consultando `profiles.role`, mas o esquema do banco usa uma tabela separada `user_roles` para armazenar os papéis dos usuários.

**Código atual (ERRADO):**
```typescript
const { data: profile, error: profileError } = await supabaseAdmin
  .from('profiles')
  .select('role')
  .eq('id', user.id)   // ← também errado: deveria ser user_id
  .single();
```

**Estrutura real do banco:**
- Tabela `profiles`: NÃO tem coluna `role`
- Tabela `user_roles`: Contém `user_id`, `role` (tipo USER-DEFINED)

## Solução

### Arquivo: `supabase/functions/test-playbook/index.ts`

**Linhas 88-103** - Substituir consulta a `profiles` por consulta a `user_roles`:

```typescript
// 5. Check user role for permission
const { data: userRoleData, error: roleError } = await supabaseAdmin
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)  // ← user_id, não id
  .maybeSingle();          // ← maybeSingle() pois usuário pode não ter role

if (roleError) {
  console.error('[test-playbook] Failed to fetch user role:', roleError);
  // Don't block - just treat as non-manager
}

const isManager = MANAGER_ROLES.includes(userRoleData?.role || '');
```

**Mudanças específicas:**
1. Trocar `profiles` → `user_roles`
2. Trocar `.eq('id', user.id)` → `.eq('user_id', user.id)`
3. Trocar `.single()` → `.maybeSingle()` (usuário pode não ter role atribuído)
4. Não bloquear com erro 500 se falhar busca de role - apenas tratar como não-gerente

## Impacto

| Aspecto | Avaliação |
|---------|-----------|
| Regressão | Nenhuma - apenas corrige query errada |
| Funcionalidade | Restaura feature "Testar para Mim" |
| Segurança | Mantém lógica de permissão correta |

## Testes Após Correção

1. Clicar "🧪 Testar para Mim" com email do próprio usuário → Deve funcionar
2. Manager testar para outro email → Deve funcionar
3. Usuário comum testar para outro email → Deve receber erro 403
4. Verificar logs sem erro "column profiles.role does not exist"
