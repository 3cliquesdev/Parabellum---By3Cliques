

# Auto-sync de Permissões: Novos menus disponíveis automaticamente

## Problema
Quando você adiciona um novo item de menu em `routes.ts` com uma `permission` key nova (ex: `returns.view`), essa key **não existe** na tabela `role_permissions` do banco. O painel de permissões (`RolePermissionsManager`) só mostra o que está no banco. Resultado: o menu novo não aparece para configurar.

Hoje, cada nova permission exige uma migration SQL manual para inserir a key em todos os roles.

## Solução
Criar uma **migration SQL** que faz sync automático: lê todas as permission keys únicas que existem em `routes.ts` (hardcoded na migration) e insere as que faltam para cada role, com `enabled = false` por padrão (exceto admin/general_manager).

Além disso, para o futuro, adicionar um **botão "Sincronizar Permissões"** no painel de permissões que chama uma edge function para detectar e criar as keys faltantes automaticamente.

### Etapa 1 — Migration imediata
SQL que extrai todas as permission keys de `routes.ts` e insere as faltantes para cada role:

```sql
-- Para cada permission_key usada em routes.ts que NÃO existe no banco,
-- inserir para todos os roles com enabled=false (admin/gm = true)
INSERT INTO role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT 
  r.role,
  k.key,
  k.label,
  k.category,
  r.role IN ('admin', 'general_manager')
FROM (VALUES
  -- Todas as keys de routes.ts
  ('dashboard.view', 'Ver Dashboard', 'dashboard'),
  ('analytics.view', 'Ver Analytics', 'analytics'),
  -- ... (todas as ~30 keys)
) AS k(key, label, category)
CROSS JOIN (SELECT DISTINCT role FROM role_permissions) AS r(role)
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = r.role AND rp.permission_key = k.key
);
```

### Etapa 2 — Botão "Sync Permissões" no painel admin
Adicionar no `RolePermissionsManager.tsx` um botão que:
1. Lê `universalMenuGroups` do frontend
2. Compara com as keys existentes no banco
3. Insere as faltantes via `supabase.from('role_permissions').insert()`

Isso garante que **qualquer menu novo adicionado no código** pode ser sincronizado com um clique, sem precisar de migration.

### Arquivos alterados
1. **Nova migration SQL** — insere todas as permission keys faltantes
2. **`src/components/users/RolePermissionsManager.tsx`** — botão "Sincronizar Permissões"
3. **Novo hook `src/hooks/useSyncPermissions.ts`** — lógica de detecção e inserção de keys faltantes

