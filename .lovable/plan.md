
# Fix: Fundo escuro no Client Portal

## Problema
A página usa classes semânticas do tema (`bg-muted/40`, `bg-card`, `border-border`) que no tema escuro resolvem para cinza escuro. Precisamos forçar cores claras explícitas.

## Alterações — `src/pages/ClientPortal.tsx`

| Linha | De | Para |
|-------|----|------|
| 43 | `bg-muted/40` | `bg-gray-50` |
| 67 | `bg-card rounded-xl shadow-sm border border-border/50` | `bg-white rounded-xl shadow-sm border border-gray-200` |
| 92 | `bg-card rounded-xl shadow-sm border border-border/50 p-5 mb-4` | `bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4` |

Nenhuma outra mudança. Header gradiente, abas, rodapé e lógica permanecem intactos.
