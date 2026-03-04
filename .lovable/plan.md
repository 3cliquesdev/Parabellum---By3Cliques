

# Plan: Filtrar "Atribuir a" por Departamento + Busca por Nome

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Situação Atual

No `CreateTicketDialog.tsx` (linhas 460-473), o dropdown "Atribuir a" lista **todos** os `supportUsers` sem:
- Ordenação alfabética garantida
- Filtro por departamento selecionado
- Busca por nome

## Solução

Modificar apenas **`src/components/support/CreateTicketDialog.tsx`**:

1. **Importar `useUsersByDepartment`** — já existe e retorna usuários vinculados a um departamento via `agent_departments`
2. **Lógica de filtragem**:
   - Se `departmentId` está selecionado → mostrar apenas usuários daquele departamento (via `useUsersByDepartment`)
   - Se não → mostrar todos os `supportUsers` (comportamento atual)
3. **Ordenação alfabética** — aplicar `.sort()` por `full_name` na lista final
4. **Busca por nome** — trocar o `Select` por um `Popover` com `Input` de busca (padrão já usado no componente para tags)
5. **Reset `assignedTo`** quando departamento mudar — para evitar atribuir alguém que não pertence ao novo departamento

## Mudanças específicas

- Importar `useUsersByDepartment` 
- Adicionar estado `assignedSearch` para filtro por nome
- Quando `departmentId` muda, limpar `assignedTo`
- Substituir o `Select` de "Atribuir a" por um `Popover` com busca (similar ao seletor de tags)
- Lista exibida: filtrada por departamento (se selecionado) + busca por nome + ordenada alfabeticamente

## Impacto
- Zero regressão: lógica de submit e campos não mudam
- UX melhorada: usuário encontra o agente mais rápido
- 1 arquivo modificado

