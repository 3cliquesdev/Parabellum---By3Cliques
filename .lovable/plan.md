
# Contrato de Paridade: Admin = Gerentes (FULL_ACCESS_ROLES)

## Diagnostico

O editor de fluxos (Chat Flow Editor) ja e identico para todos os roles com permissao `settings.chat_flows`. Nao ha nenhum filtro de role dentro dos componentes do editor. Os screenshots mostram a mesma interface com scroll e tema diferentes.

Porem, existem areas do sistema com restricoes exclusivas de admin que precisam ser abertas para gerentes conforme o contrato de paridade.

## Areas com Restricao Exclusiva de Admin (a corrigir)

| Area | Arquivo | Restricao Atual | Proposta |
|---|---|---|---|
| Super Admin Panel | `SuperAdminPanel.tsx` | `isAdmin` only | Abrir para `hasFullAccess(role)` |
| Instagram Secrets | `InstagramSecretsCard.tsx` | `isAdmin` only | Abrir para `hasFullAccess(role)` |
| Restaurar evidencia | `useRestoreTicketAttachment.tsx` | `isAdmin` only | Abrir para `hasFullAccess(role)` |
| Permissao `super_admin.access` | `role_permissions` | Verificar quais roles tem | Garantir que gerentes tenham |

## Implementacao

### 1. SuperAdminPanel.tsx -- Abrir para gerentes

**Arquivo:** `src/pages/SuperAdminPanel.tsx`

Mudar de:
```typescript
if (!isAdmin) {
  return <Navigate to="/" replace />;
}
```

Para:
```typescript
const { role } = useUserRole();
if (!hasFullAccess(role)) {
  return <Navigate to="/" replace />;
}
```

Importar `hasFullAccess` de `@/config/roles`.

### 2. InstagramSecretsCard.tsx -- Abrir para gerentes

**Arquivo:** `src/components/settings/InstagramSecretsCard.tsx`

Mudar de:
```typescript
if (!isAdmin) return null;
```

Para:
```typescript
if (!hasFullAccess(role)) return null;
```

### 3. useRestoreTicketAttachment.tsx -- Abrir para gerentes

**Arquivo:** `src/hooks/useRestoreTicketAttachment.tsx`

Mudar de:
```typescript
if (!isAdmin) {
  throw new Error("Apenas administradores podem restaurar evidencias");
}
```

Para:
```typescript
if (!hasFullAccess(role)) {
  throw new Error("Apenas administradores e gerentes podem restaurar evidencias");
}
```

### 4. Permissao `super_admin.access` no banco

Garantir que os roles de gestao (`manager`, `general_manager`, `support_manager`, `cs_manager`, `financial_manager`) tenham `super_admin.access = true` na tabela `role_permissions`.

```sql
UPDATE role_permissions 
SET enabled = true, updated_at = now()
WHERE permission_key = 'super_admin.access' 
AND role IN ('manager', 'general_manager', 'support_manager', 'cs_manager', 'financial_manager');
```

### 5. Contrato formalizado em `src/config/roles.ts`

Adicionar comentario-contrato no arquivo de roles para futuras implementacoes:

```typescript
/**
 * CONTRATO DE PARIDADE:
 * Todos os roles em FULL_ACCESS_ROLES devem ter acesso identico
 * a todas as funcionalidades do sistema.
 * 
 * REGRA: Nunca usar `isAdmin` sozinho para restringir acesso.
 * Sempre usar `hasFullAccess(role)` que inclui todos os gerentes.
 * 
 * Unica excecao: alteracao de permissoes do role "admin" 
 * (auto-protecao em RolePermissionsManager).
 */
```

## Resumo

| O que muda | Antes | Depois |
|---|---|---|
| SuperAdminPanel | So admin | Admin + todos gerentes |
| InstagramSecretsCard | So admin | Admin + todos gerentes |
| Restaurar evidencia | So admin | Admin + todos gerentes |
| Permissao super_admin.access | Verificar | Todos gerentes habilitados |
| Contrato de paridade | Informal | Formalizado em `roles.ts` |

## Sobre o Editor de Fluxos

O editor de fluxos (`ChatFlowEditor`, `AIResponsePropertiesPanel`, `RAGSourcesSection`, `BehaviorControlsSection`, `SmartCollectionSection`) **ja e identico para todos**. Nao ha nenhuma logica de role dentro dos componentes. Qualquer usuario com permissao `settings.chat_flows` ve exatamente a mesma interface.

## Impacto

- Zero regressao: admin continua com acesso total
- Upgrade: gerentes ganham acesso ao painel Super Admin e configuracoes
- Padrao futuro: `hasFullAccess(role)` e a unica forma correta de verificar acesso privilegiado
- Seguranca mantida: roles operacionais (agentes, consultores, vendedores) continuam sem acesso
