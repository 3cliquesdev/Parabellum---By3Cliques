

# Fix: Bloquear envio de mensagem sem assumir controle (autopilot)

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Problema

Quando uma conversa está em `ai_mode = autopilot`, agentes humanos conseguem enviar mensagens pelo composer sem clicar em "Assumir controle". Isso causa conflito: a IA continua respondendo automaticamente enquanto o humano também envia, gerando confusão para o cliente.

## Solução

**Arquivo: `src/components/inbox/SuperComposer.tsx`**

Adicionar uma segunda regra de bloqueio no `handleSend` (logo após o bloqueio de `waiting_human` existente na linha 313):

- Se `aiMode === 'autopilot'` e `messageMode !== 'internal'` (nota interna), bloquear o envio com toast: **"Você precisa assumir a conversa antes de enviar mensagens. Clique em 'Assumir Controle'."**
- Notas internas (`messageMode === 'internal'`) continuam permitidas em qualquer modo — não afetam o cliente.

Adicionalmente, exibir um **banner visual** acima do composer quando `aiMode === 'autopilot'`, alertando o agente que a IA está no controle e que ele precisa assumir antes de digitar.

Mudança de ~15 linhas no SuperComposer. Zero regressão nos demais componentes.

