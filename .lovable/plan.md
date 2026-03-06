

# Condição "Tem Organização?" no Chat Flow

## Resumo

Ja existe tudo pronto no motor. O campo `organization_id` ja esta disponivel no contexto do contato (`contactData`), e o tipo `has_data` ja avalia se o campo tem valor. So falta expor no editor.

## Alteracoes

### 1. `src/components/chat-flows/variableCatalog.ts`
- Adicionar `{ value: "organization_id", label: "Tem Organização?" }` ao array `CONDITION_CONTACT_FIELDS`

### 2. `src/components/chat-flows/nodes/ConditionNode.tsx`
- Adicionar `organization_id: "Tem Organização?"` ao mapa `friendlyFieldNames`

### Zero alteracoes no backend
O motor (`process-chat-flow`) ja resolve `organization_id` via `contactData` e o tipo `has_data` ja funciona para verificar se tem valor.

## Como usar no editor

1. Adicionar no Condition → Tipo: "Tem dado" → Campo: "👤 Tem Organização?"
2. Caminho Sim = tem org vinculada → direcionar para Transfer/departamento especifico
3. Caminho Nao = sem org → seguir fluxo padrao

