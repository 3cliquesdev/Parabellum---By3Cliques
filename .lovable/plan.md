

# Corrigir Banner "Nova versão disponível!" Duplicado

## Problema
O componente `UpdateAvailableBanner` está sendo renderizado **2 vezes**:
1. Em `src/App.tsx` (linha 151) — nível global, fora do Layout
2. Em `src/components/Layout.tsx` (linha 28) — dentro do Layout

Isso causa os 2 banners visíveis na screenshot.

## Solução
Remover a instância duplicada de `src/components/Layout.tsx` (linhas 7-8 e 28), mantendo apenas a do `App.tsx` que é o ponto correto (global, acima de tudo).

## Arquivo afetado
- `src/components/Layout.tsx` — remover import e uso do `UpdateAvailableBanner`

Nenhuma outra feature é impactada. O banner continuará funcionando normalmente via `App.tsx`.

