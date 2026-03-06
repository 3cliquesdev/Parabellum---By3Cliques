

# Vincular Organização direto no perfil do Contato

## Contexto

O cliente é identificado por email como pagante, mas sua equipe (outros números) também busca suporte. A ideia é vincular esses contatos extras a uma organização diretamente na página de detalhes, para que sejam reconhecidos como parte da mesma empresa.

## Alteração

### `src/components/ContactInfoCard.tsx`

Na seção onde mostra a organização (linhas 132-137), transformar em elemento editável:

- **Se já tem organização**: mostrar nome + botão "Trocar" + botão "Desvincular" (com confirmação)
- **Se não tem organização**: mostrar botão "Vincular organização"
- Ao clicar, abrir um **Popover** com campo de busca que consulta `organizations` via `ilike` (mínimo 2 chars, limit 20)
- Ao selecionar, faz `update contacts set organization_id = org.id`
- Ao desvincular, faz `update contacts set organization_id = null`
- Invalidar query `["contact", id]` para refresh imediato

### Sem novos arquivos / hooks

- Mutation inline com `useMutation` + `useQueryClient` direto no componente (padrão simples, não justifica hook separado)
- Query de busca com `useQuery` inline, ativada por `searchTerm.length >= 2`

### Zero migrations

- `contacts.organization_id` já existe e a RLS já permite update

