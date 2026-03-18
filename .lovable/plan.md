

# Problema: Time comercial não consegue assumir conversas enviadas por template

## Causa raiz

Quando um vendedor envia um template (Reengage ou Pipeline), a conversa fica com:
- `ai_mode: 'waiting_human'`
- `assigned_to: o próprio vendedor`

Na tela do ChatWindow, a lógica `canShowTakeControl` verifica:
```
canShowTakeControl = isAutopilot || isWaitingHuman || !assigned_to
```

Como `isWaitingHuman = true`, o compositor de mensagens é **escondido** e substituído pelo banner "Aguardando atendimento humano - Clique em Assumir para digitar". O vendedor precisa clicar em "Assumir" mesmo já sendo o dono da conversa.

Porém, o RPC `take_control_secure` exige que agentes estejam com status **"online"**. Se o vendedor não marcou seu status como online, o clique em "Assumir" falha com "Altere seu status para Online" — travando o vendedor numa tela sem compositor e sem conseguir responder.

Além disso, é um atrito desnecessário: se a conversa já está atribuída ao usuário (ele mesmo mandou o template), não faz sentido exigir que ele "assuma" novamente.

## Solução

Ajustar `canShowTakeControl` no `ChatWindow.tsx` para **não mostrar o banner de "Assumir"** quando a conversa já está atribuída ao próprio usuário logado. Nesse caso, o compositor deve aparecer diretamente.

### Alteração no `src/components/ChatWindow.tsx`

Linha 473, de:
```ts
const canShowTakeControl = isAutopilot || isWaitingHuman || !conversation?.assigned_to;
```

Para:
```ts
const isAssignedToMe = conversation?.assigned_to === user?.id;
const canShowTakeControl = !isAssignedToMe && (isAutopilot || isWaitingHuman || !conversation?.assigned_to);
```

Se a conversa já é do usuário (seja `waiting_human` ou qualquer outro modo), o compositor aparece direto sem exigir "Assumir".

### Resultado esperado
- Vendedor envia template → conversa abre → compositor de mensagens aparece imediatamente
- Sem banner "Assumir" para conversas que já são suas
- O botão "Assumir" continua aparecendo normalmente para conversas de outros ou da fila IA

### Arquivo a alterar
- `src/components/ChatWindow.tsx` (1 linha)

