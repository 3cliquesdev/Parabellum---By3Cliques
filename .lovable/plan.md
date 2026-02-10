

# Fix: Scroll no sino de notificacoes

## Problema

O `ScrollArea` do Radix UI precisa de uma altura fixa (`h-XX`) para ativar o scrollbar interno. Usar apenas `max-h-80` nao funciona porque o ScrollArea nao consegue calcular quando o conteudo excede o container.

Na imagem, as notificacoes continuam renderizando para baixo sem scroll, cortando o conteudo.

## Solucao

Trocar `max-h-80` por `h-80` no `ScrollArea`. Isso da uma altura fixa de 320px ao container, permitindo que o ScrollArea detecte overflow e mostre a barra de rolagem.

## Mudanca (1 linha)

**Arquivo:** `src/components/NotificationBell.tsx`, linha 145

- Antes: `<ScrollArea className="max-h-80">`
- Depois: `<ScrollArea className="h-80">`

## Impacto

- Scroll funciona corretamente no dropdown de notificacoes
- Quando ha poucas notificacoes, o espaco vazio fica visivel (comportamento aceitavel para dropdown)
- Zero quebra em qualquer outro componente

