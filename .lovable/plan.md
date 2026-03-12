

# Fix: Coluna "Consultor" mostrando "Não atribuído" na página de Contatos

## Problema

A página de Contatos usa `useProfiles()` para resolver o nome do consultor (linha 63, 319). Esse hook busca **todos os profiles** da tabela, mas o Supabase tem um limite padrão de **1000 linhas**. Como existem **6.492 profiles** no banco, Paulo Lopes (e outros consultores) podem ficar fora dos 1000 retornados, fazendo `profiles?.find(p => p.id === contact.consultant_id)` retornar `undefined` → "Não atribuído".

A página de Consultores funciona porque faz sua própria query direta buscando `consultant_id` do contato.

## Causa Raiz

`useProfiles()` retorna no máximo 1000 de 6492 profiles. O consultor pode não estar nessa amostra.

## Correção

**Arquivo:** `src/pages/Contacts.tsx`

1. Trocar `useProfiles` por `useConsultants` (que busca apenas os 6 consultores, não 6492 profiles)
2. Ajustar o `find` na linha 319 para usar a lista de consultores

| Linha | Antes | Depois |
|-------|-------|--------|
| 42 | `import { useProfiles } from "@/hooks/useProfiles"` | `import { useConsultants } from "@/hooks/useConsultants"` |
| 63 | `const { data: profiles } = useProfiles()` | `const { data: consultants } = useConsultants(true)` |
| 319 | `profiles?.find(p => p.id === contact.consultant_id)` | `consultants?.find(c => c.id === contact.consultant_id)` |

3 linhas alteradas. Zero mudança de lógica — apenas buscando do dataset correto (6 consultores ao invés de 6492 profiles).

