

# Fix: Scroll na lista de agentes do "Atribuir a"

O `ScrollArea` está com `max-h-48` mas sem `h-48` — o Radix ScrollArea precisa de uma altura fixa para ativar o scroll. Vou trocar `max-h-48` por `h-48` e garantir que o conteúdo interno possa crescer.

## Mudança

**`src/components/support/CreateTicketDialog.tsx`** (linha 502):
- De: `<ScrollArea className="max-h-48">`
- Para: `<ScrollArea className="h-48 overflow-auto">`

1 linha alterada, zero regressão.

