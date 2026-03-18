

# Melhorar visual de mensagens de template e botão de reenvio

## Problemas identificados (screenshot)
1. O badge "Template" com cor esmeralda conflita com o fundo azul da bolha de mensagem enviada
2. O texto do template, timestamp, status e botão "Reenviar" estão todos comprimidos e ilegíveis
3. A borda esquerda esmeralda não funciona visualmente dentro de uma bolha azul
4. O botão "Reenviar" aparece inline com o timestamp, ficando minúsculo

## Solução

### 1. `MessageBubble.tsx` — Redesign do template dentro da bolha
- Remover borda esmeralda e cores que conflitam com fundo azul
- Badge "Template" usar cor que funcione em ambos os fundos (branco/translúcido em bolha azul)
- Corpo do template com espaçamento adequado e texto legível
- Separador visual sutil entre header e body

### 2. `MessageStatusIndicator.tsx` — Botão "Reenviar" mais visível
- Aumentar levemente o botão de retry para ser mais clicável
- Usar estilo que contraste bem com fundo azul (branco com opacity para bolhas de agente)
- Mover o botão para uma linha separada abaixo do timestamp quando em estado `failed`

### Arquivos a alterar
- `src/components/inbox/MessageBubble.tsx` — cores adaptativas para template
- `src/components/MessageStatusIndicator.tsx` — layout do retry melhorado

