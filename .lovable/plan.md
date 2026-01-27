
## Plano: Departamentos Hierarquicos (Suporte > Suporte Pedidos)

### Situacao Atual

Atualmente, os departamentos sao uma lista plana:
- Comercial
- Customer Success
- Financeiro
- Marketing
- Operacional
- **Suporte** ← Departamento principal
- **Suporte Pedidos** ← Subdepartamento
- **Suporte Sistema** ← Subdepartamento

Todos aparecem no mesmo nivel no Select, sem indicacao de hierarquia.

---

### Solucao Proposta

Adicionar campo `parent_id` na tabela `departments` para criar estrutura hierarquica. Na UI, agrupar subdepartamentos abaixo do departamento pai.

---

### Alteracoes no Banco de Dados

**Migration: Adicionar campo parent_id**

```sql
-- Adicionar coluna parent_id para hierarquia
ALTER TABLE departments 
ADD COLUMN parent_id uuid REFERENCES departments(id) ON DELETE SET NULL;

-- Atualizar Suporte Pedidos para ser filho de Suporte
UPDATE departments 
SET parent_id = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a'
WHERE id = '2dd0ee5c-fd20-44be-94ad-f83f1be1c4e9';

-- Atualizar Suporte Sistema para ser filho de Suporte
UPDATE departments 
SET parent_id = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a'
WHERE id = 'fd4fcc90-22e4-4127-ae23-9c9ecb6654b4';
```

---

### Alteracoes na Interface

**Arquivo 1: `src/hooks/useDepartments.tsx`**

Atualizar interface para incluir `parent_id`:

```typescript
export interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  whatsapp_number?: string | null;
  parent_id?: string | null;  // NOVO
  created_at: string;
  updated_at: string;
}
```

---

**Arquivo 2: `src/components/UserDialog.tsx`**

Refatorar o Select de departamento para mostrar hierarquia com grupos:

```tsx
<SelectContent className="rounded-xl">
  {/* Departamentos principais (sem parent_id) */}
  {departments?.filter(d => d.is_active && !d.parent_id).map((dept) => {
    // Buscar subdepartamentos
    const children = departments?.filter(
      child => child.is_active && child.parent_id === dept.id
    );
    
    return (
      <Fragment key={dept.id}>
        {/* Departamento pai */}
        <SelectItem value={dept.id} className="py-3">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: dept.color }}
            />
            <span className="font-medium">{dept.name}</span>
          </div>
        </SelectItem>
        
        {/* Subdepartamentos com indentacao */}
        {children?.map((child) => (
          <SelectItem key={child.id} value={child.id} className="py-3 pl-8">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: child.color }}
              />
              <span className="text-sm">{child.name}</span>
            </div>
          </SelectItem>
        ))}
      </Fragment>
    );
  })}
</SelectContent>
```

---

### Visual Esperado

```text
┌────────────────────────────────────┐
│ Departamento                    ▼  │
├────────────────────────────────────┤
│ ● Comercial                        │
│ ● Customer Success                 │
│ ● Financeiro                       │
│ ● Marketing                        │
│ ● Operacional                      │
│ ● Suporte                          │  ← Pode selecionar o pai
│    ○ Suporte Pedidos               │  ← Ou um específico
│    ○ Suporte Sistema               │
└────────────────────────────────────┘
```

---

### Comportamento

1. **Selecionar "Suporte"**: Usuario vai para o pool geral de suporte
2. **Selecionar "Suporte Pedidos"**: Usuario vai para o grupo especializado em pedidos
3. **Roteamento mantido**: O sistema de roteamento continua funcionando normalmente (usa o `department_id` direto)

---

### Arquivos a Modificar

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| Migration SQL | Novo | Adicionar `parent_id` e atualizar registros existentes |
| `src/hooks/useDepartments.tsx` | Edicao | Adicionar `parent_id` na interface |
| `src/components/UserDialog.tsx` | Edicao | Mostrar hierarquia no Select |
| `src/integrations/supabase/types.ts` | Automatico | Sera atualizado apos migration |

---

### Beneficios

- **Organizacao visual**: Fica claro que Suporte Pedidos e Suporte Sistema sao subgrupos
- **Flexibilidade**: Pode criar hierarquias para outros departamentos no futuro (Comercial > Comercial Internacional)
- **Retrocompativel**: Departamentos sem `parent_id` continuam funcionando normalmente
- **Sem quebra**: O roteamento, transferencias e filtros continuam usando o `department_id` diretamente
