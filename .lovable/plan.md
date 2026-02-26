

# Fix: IA para de responder após exit keyword em nó de inatividade

## Recomendação

**As duas coisas devem acontecer juntas:**

1. Se `forbid_financial` está ativo no nó de IA, a IA já informa ao cliente que não resolve questões financeiras (isso já funciona — o guard financeiro envia a mensagem antes de sair do nó)
2. Após sair do nó de IA (por exit keyword ou max_interactions), o fluxo **deve continuar para o próximo nó** normalmente

O bug real é que, ao sair do nó de IA, se o próximo nó for uma **condição de inatividade**, o fluxo trava porque a lógica trata como "parar e esperar timeout" — mas o usuário acabou de enviar uma mensagem, então está **ativo** e deveria seguir pelo caminho "Não" (ativo) imediatamente.

## Correções (1 arquivo)

### `supabase/functions/process-chat-flow/index.ts`

**Correção 1 — Inatividade durante auto-traverse após mensagem do usuário (linhas 1273-1304)**

Quando a condição de inatividade é alcançada durante auto-traverse e existe uma mensagem do usuário no contexto (`userMessage` não é vazio e `inactivityTimeout` é false), o nó deve ser avaliado como "ativo" (path `false`) e continuar a travessia ao invés de parar com `waiting_input`.

Lógica: adicionar verificação `if (userMessage && userMessage.trim().length > 0)` antes do bloco de "stop and wait". Se o usuário acabou de enviar mensagem → seguir caminho "Não" (ativo). Só parar e esperar quando não há mensagem recente (cenário do cron/trigger automático).

**Correção 2 — ReferenceError em `conversation` (linhas 1192 e 1211)**

A variável `conversation` não existe neste escopo. Substituir por:
- Linha 1192: `department_id: null` (ou buscar do `activeState` se disponível)
- Linha 1211: `channel: 'web_chat'` (fallback seguro)

## Resultado esperado

1. Usuário envia "reembolso" → IA reconhece exit keyword → sai do nó de IA
2. Próximo nó é condição de inatividade → como o usuário acabou de enviar mensagem, segue caminho "Não" (ativo)
3. Fluxo continua normalmente para o nó seguinte no caminho "ativo"

