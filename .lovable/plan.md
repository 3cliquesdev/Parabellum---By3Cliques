

# Fix: Logo cortada na sidebar — ajustar para caber exatamente

## Problema
A logo "Cliques C..." está sendo cortada na sidebar porque tem `h-12 w-auto`, o que permite que a largura ultrapasse o container de 16rem (256px).

## Correção

### `src/components/AppSidebar.tsx` (L328-334 e L341-346)

**Sidebar expandida (L328-334):**
- Trocar `h-12 w-auto` por `max-h-14 w-full object-contain` — a logo ocupa toda a largura disponível e escala proporcionalmente, sem ultrapassar o container.

**Sidebar colapsada (L341-346):**
- Trocar `h-10 w-auto` por `max-h-10 w-full object-contain` — mesma lógica para o modo ícone.

Resultado: a logo se adapta ao espaço disponível, sem corte, independente da proporção da imagem enviada pelo admin.

