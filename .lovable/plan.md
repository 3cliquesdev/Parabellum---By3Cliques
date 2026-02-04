
## Plano: Permitir Visibilidade de Conversas do Departamento para Agentes

### ✅ IMPLEMENTADO

---

### Mudança 1: Usar departamento do PERFIL ao invés de filtro por nome

**Arquivo:** `src/hooks/useDepartmentsByRole.tsx`

- Removido filtro por nomes hardcoded ("Suporte", "Support", etc.)
- Agora usa `userDepartmentId` do perfil do usuário como fonte única da verdade
- Se usuário não tem departamento configurado, retorna array vazio (só vê conversas atribuídas a ele)

---

### Mudança 2: Adicionar visibilidade de conversas de colegas

**Arquivo:** `src/hooks/useInboxView.tsx`

Query alterada de:
```javascript
query.or(`assigned_to.eq.${userId},and(assigned_to.is.null,department.in.(${departmentIds.join(",")}))`);
```

Para:
```javascript
query.or(`assigned_to.eq.${userId},department.in.(${departmentIds.join(",")}),and(assigned_to.is.null,department.is.null)`);
```

Agora agentes veem TODAS as conversas do seu departamento, incluindo as atribuídas a colegas.

---

### Mudança 3: Atualizar edge function get-inbox-counts

**Arquivo:** `supabase/functions/get-inbox-counts/index.ts`

- Busca `userDepartmentId` do perfil do usuário
- Aplica mesma lógica de visibilidade: `department.eq.${userDepartmentId}` ao invés de filtro por nome
- Removidos filtros hardcoded por nome de departamento

---

### Arquivos Modificados

| Arquivo | Status |
|---------|--------|
| `src/hooks/useDepartmentsByRole.tsx` | ✅ Atualizado |
| `src/hooks/useInboxView.tsx` | ✅ Atualizado |
| `src/hooks/useConversations.tsx` | ✅ Atualizado |
| `supabase/functions/get-inbox-counts/index.ts` | ✅ Atualizado e deployed |

---

### Resultado Esperado

Miguel Fedes (e outros agentes do "Suporte Sistema") agora devem ver:
- Suas próprias conversas atribuídas
- Conversas atribuídas a colegas do mesmo departamento (ex: Mabile Silva)
- Conversas não atribuídas do pool geral
