

# Fix: Pipeline padrão não atualiza após salvar

## Problema
O `useSetDefaultPipeline` salva no banco corretamente, mas invalida `["profiles"]` (react-query). Porém o `useAuth` gerencia o `profile` internamente com `useState`, não usa react-query. Resultado: o `profile.default_pipeline_id` nunca atualiza na memória, a estrela não fica amarela, e na próxima visita o pipeline não é pré-selecionado.

## Solução

### 1. `useSetDefaultPipeline.ts` — Chamar `refetchProfile` após salvar
- Receber `refetchProfile` como parâmetro ou via callback no `onSuccess`
- Após mutation bem-sucedida, chamar `refetchProfile()` do useAuth para atualizar o estado local

### 2. `Deals.tsx` — Passar `refetchProfile` para o hook
- Extrair `refetchProfile` do `useAuth()`
- No `onSuccess` do `setDefaultPipeline`, chamar `refetchProfile()` para que o `profile` local se atualize
- Alternativa mais simples: usar `mutate` com callback `onSuccess` direto no Deals.tsx

### Implementacao concreta
- Modificar `useSetDefaultPipeline` para aceitar um callback `onSuccess` opcional
- Em `Deals.tsx`: extrair `refetchProfile` do `useAuth()` e passar como callback ao mutate

### Arquivos a alterar
- `src/hooks/useSetDefaultPipeline.ts` — aceitar callback onSuccess
- `src/pages/Deals.tsx` — passar `refetchProfile` no onSuccess do mutate

