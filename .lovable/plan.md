

# Melhorias no Gerenciamento de Contatos nas Organizações

## Status atual

A implementação já está funcional com schema correto (`first_name`, `last_name` confirmados no banco). Os pontos de melhoria solicitados são:

## Alterações

### 1. Busca escalável — mínimo 2 caracteres (hook `useOrganizationContacts.tsx`)
- Trocar `search.length >= 1` por `search.length >= 2` no `enabled` da query de busca
- Já está com `.limit(20)` — ok

### 2. Suporte a "mover contato de outra org" com confirmação (hook + dialog)

**Hook**: Alterar `useSearchContactsForOrg` para buscar contatos de **qualquer** organização (não só `organization_id IS NULL`). Incluir `organization_id` no select para saber se já pertence a outra org.

**Dialog**: No resultado da busca, se o contato já tem `organization_id` (e é diferente do orgId atual):
- Mostrar nome da org atual (precisamos de um join ou lookup)
- Ao clicar "Adicionar", abrir `AlertDialog` de confirmação: "Este contato está vinculado a outra organização. Deseja movê-lo?"
- Só executa o `addContact` se confirmar

Para mostrar o nome da org de origem, faremos um join simples: `.select("id, first_name, last_name, phone, email, organization_id, organizations(name)")`.

### 3. Confirmação ao remover contato (dialog)
- Envolver o botão "Remover" em um `AlertDialog` com mensagem "Remover vínculo de [nome] com esta organização?"

### 4. Busca mínima 2 chars no placeholder
- Atualizar placeholder do input para indicar "Digite ao menos 2 caracteres..."

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useOrganizationContacts.tsx` | Busca >= 2 chars, remover filtro `IS NULL`, adicionar join org name |
| `src/components/OrganizationContactsDialog.tsx` | AlertDialog confirmação remover, AlertDialog confirmação mover, mostrar org atual nos resultados |

## Sem impacto

- Zero migration
- Zero mudança em RLS (o update de `organization_id` já funciona via ContactDialog, mesma policy)
- Permissões: mantém o acesso atual (quem já edita contatos pode vincular/desvincular)

