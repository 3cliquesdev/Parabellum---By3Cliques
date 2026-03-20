

# Feature: Manter Conversas Abertas Fora do Horário (por Departamento)

## O Que Muda

Departamentos como Comercial poderão ser configurados para **não encerrar** conversas fora do horário — elas recebem a mensagem de "fora do horário" mas ficam abertas na fila de distribuição para o dia seguinte. Isso será controlável por um toggle na edição de cada departamento.

## Implementação

### 1. Migration — Nova coluna `after_hours_keep_open`

Adicionar `after_hours_keep_open BOOLEAN DEFAULT false` na tabela `departments`. Os departamentos Comercial já serão ativados por padrão via UPDATE.

### 2. `auto-close-conversations/index.ts` — Respeitar flag por departamento

No Stage 6 (after-hours cleanup), antes de fechar cada conversa:
- Buscar o departamento da conversa
- Se `after_hours_keep_open = true`: enviar mensagem de fora do horário + aplicar tag, mas **não fechar** a conversa (mantém `status: 'open'`, `ai_mode: 'waiting_human'`)
- Se `after_hours_keep_open = false`: comportamento atual (fecha a conversa)

### 3. UI — Toggle no `DepartmentDialog.tsx`

Adicionar um switch "Manter conversa aberta fora do horário" no formulário de departamento, com descrição: "Conversas recebem mensagem de fora do horário mas permanecem na fila para distribuição no próximo dia útil."

### 4. Hooks e Types

- `useDepartments.tsx`: Adicionar `after_hours_keep_open` à interface `Department`
- `useUpdateDepartment.tsx`: Adicionar campo ao `UpdateDepartmentParams`
- `useCreateDepartment.tsx`: Adicionar campo ao payload de criação

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Adicionar coluna + UPDATE nos dept Comercial |
| `supabase/functions/auto-close-conversations/index.ts` | Checar flag antes de fechar |
| `src/components/DepartmentDialog.tsx` | Toggle "Manter aberta fora do horário" |
| `src/hooks/useDepartments.tsx` | Interface atualizada |
| `src/hooks/useUpdateDepartment.tsx` | Param atualizado |
| `src/hooks/useCreateDepartment.tsx` | Param atualizado |

