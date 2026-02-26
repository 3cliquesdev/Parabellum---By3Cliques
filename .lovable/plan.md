

# Mostrar X ao passar o mouse na linha da edge

## Problema
O botão X existe mas só aparece ao passar o mouse exatamente em cima dele (que é invisível). Precisa aparecer ao passar o mouse na **linha** (path) da edge.

## Alteração (1 arquivo)

### `src/components/playbook/ButtonEdge.tsx`
- Adicionar um path invisível mais largo (strokeWidth ~20px, transparent) sobre a edge para servir de hit area
- Usar estado `hovered` controlado por `onMouseEnter`/`onMouseLeave` no path invisível
- Quando `hovered = true`, o botão X fica visível (opacity-100)
- Manter o hover direto no botão também funcionando

