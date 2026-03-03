

# Adicionar suporte a ID do consultor na importação

Analisei o projeto atual e sigo as regras da base de conhecimento.

## O que muda

Atualmente a importação só aceita o **nome** do consultor (coluna `consultor`) e resolve para UUID internamente. O upgrade adiciona uma coluna **`id_consultor`** que aceita o UUID diretamente — se fornecido, tem prioridade sobre o nome.

## Alterações

### 1. Frontend — `ImportClients.tsx`
- Adicionar `consultant_id` ao mapeamento automático com aliases: `id_consultor`, `consultant_id`, `id consultor`
- Atualizar template de download para incluir coluna `id_consultor`

### 2. Hook — `useImportContacts.tsx`
- Adicionar `consultant_id` à interface `ContactRow`

### 3. Edge Function — `bulk-import-contacts/index.ts`
- Adicionar `consultant_id` à interface `ContactRow`
- Em `prepareContactData`: se `consultant_id` vier preenchido (UUID válido + tem role consultant), usar diretamente sem resolver por nome
- Fallback: se `consultant_id` inválido, tentar resolver por `assigned_to` (nome) como hoje

### Fluxo de prioridade
```text
consultant_id (UUID direto) → assigned_to (nome) → null
```

Sem impacto em funcionalidades existentes — é um upgrade puro com fallback mantido.

