

# Fix: Clique nas variáveis do autocomplete não funciona

## Problema
Quando o usuário clica em uma variável no dropdown do `VariableAutocomplete`, nada acontece. A causa é que o `Popover` fecha via `onOpenChange(false)` **antes** do `onSelect` do `CommandItem` disparar — o clique no item causa perda de foco do textarea (trigger), e o Popover interpreta como "clique fora" e fecha.

## Solução

Alterar `VariableAutocomplete.tsx`:

1. **No `PopoverContent`**: adicionar `onInteractOutside={(e) => e.preventDefault()}` para impedir que cliques dentro do popover o fechem prematuramente.

2. **No `onOpenChange`**: manter apenas para fechar quando realmente necessário (ex: Escape), não quando o usuário interage com o conteúdo.

3. **No `CommandItem`**: garantir que `onSelect` chama `insertVariable` e depois `setOpen(false)` explicitamente (isso já está feito, mas o popover fecha antes).

Alteração única em ~3 linhas no arquivo `src/components/chat-flows/VariableAutocomplete.tsx`.

