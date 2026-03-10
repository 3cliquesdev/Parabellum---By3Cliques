

# Configurar tag de encerramento por departamento

## Situação atual
A tag "9.98 Falta de Interação" está **hardcoded** na edge function (`FALTA_INTERACAO_TAG_ID`). Todos os estágios de auto-close usam a mesma tag fixa. O usuário quer poder escolher qual tag aplicar ao encerrar conversas humanas por inatividade — por departamento.

## Plano

### 1. Nova coluna: `human_auto_close_tag_id`
Adicionar `human_auto_close_tag_id UUID NULL REFERENCES tags(id)` na tabela `departments`.

### 2. UI no DepartmentDialog
Quando o toggle "Encerrar conversas humanas por inatividade" estiver ativo, mostrar um **Select** com as tags existentes (consultadas via `useTags`), permitindo ao usuário escolher qual tag aplicar ao encerrar.

**Arquivos**: `src/components/DepartmentDialog.tsx`

### 3. Hooks e tipo Department
Adicionar `human_auto_close_tag_id` nos hooks `useCreateDepartment`, `useUpdateDepartment` e no tipo `Department` em `useDepartments`.

### 4. Edge function — usar tag configurada
No Stage 4 (human inactivity) de `auto-close-conversations/index.ts`:
- Incluir `human_auto_close_tag_id` no select dos departamentos
- Se configurado, usar essa tag em vez de `FALTA_INTERACAO_TAG_ID`
- Se não configurado, manter fallback para a tag padrão

### Arquivos a alterar
- **Migração SQL** — nova coluna
- `src/components/DepartmentDialog.tsx` — select de tag
- `src/hooks/useCreateDepartment.tsx`
- `src/hooks/useUpdateDepartment.tsx`
- `src/hooks/useDepartments.tsx`
- `supabase/functions/auto-close-conversations/index.ts` — Stage 4

