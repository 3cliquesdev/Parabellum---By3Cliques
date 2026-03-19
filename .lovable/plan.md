
Objetivo: corrigir o caso em que o atendente vê “Você precisa assumir a conversa antes de enviar mensagens”, mas não aparece botão para assumir.

Diagnóstico
- O problema real não é mais visibilidade do botão.
- Hoje existe um estado inconsistente possível:
  - a conversa fica `assigned_to = usuário atual`
  - mas continua com `ai_mode = waiting_human`
- Nesse estado:
  - `ChatWindow` esconde o botão porque entende que a conversa “já é minha”
  - `SuperComposer` bloqueia o envio porque vê `waiting_human`
- Resultado: o atendente fica travado, exatamente como no print.

Onde pode falhar
1. `supabase/functions/distribute-pending-conversations/index.ts`
- Ao atribuir a conversa ao agente, mantém:
  - `assigned_to: agentId`
  - `ai_mode: 'waiting_human'`
- Isso é o principal causador do bug.

2. `src/components/inbox/SuperComposer.tsx`
- Bloqueia qualquer envio quando `aiMode === 'waiting_human'`, sem considerar se a conversa já está atribuída ao próprio agente.

3. `src/components/ChatWindow.tsx`
- O botão “Assumir” só aparece quando `!isAssignedToMe`.
- Então, se a conversa já veio atribuída ao atendente mas ainda ficou em `waiting_human`, não aparece botão nenhum.

Plano de correção
1. Corrigir a origem do estado inconsistente no backend
- Em `distribute-pending-conversations`, quando a conversa for atribuída a um agente específico, trocar `ai_mode` para `copilot`.
- Isso alinha com o comportamento já usado em `dispatch-conversations`.

2. Adicionar proteção defensiva no frontend
- Em `ChatWindow`, tratar `assigned_to === user.id` + `waiting_human` como estado recuperável.
- Opções seguras:
  - ou mostrar novamente o botão “Assumir”
  - ou considerar essa conversa como liberada para composer
- Minha recomendação: liberar o fluxo para o dono da conversa, sem depender do botão.

3. Ajustar o bloqueio do composer
- Em `SuperComposer`, só bloquear `waiting_human` se a conversa não estiver atribuída ao usuário atual.
- Se já estiver atribuída ao próprio atendente, permitir envio normalmente.

4. Auditar outros pontos de atribuição
- Revisar rapidamente todos os caminhos que fazem `assigned_to = algum agente` para garantir que não deixem `waiting_human`.
- O ponto suspeito confirmado é `distribute-pending-conversations`; `dispatch-conversations` já está correto.

Resultado esperado
- Conversa atribuída ao atendente:
  - entra em `copilot` e o campo de mensagem funciona
- Conversa ainda na fila humana sem dono:
  - mostra botão “Assumir”
- Não haverá mais o estado “precisa assumir, mas sem botão”.

Arquivos a alterar
- `supabase/functions/distribute-pending-conversations/index.ts`
- `src/components/ChatWindow.tsx`
- `src/components/inbox/SuperComposer.tsx`

Validação após implementar
1. Transferir/atribuir uma conversa para um atendente
2. Abrir em `/inbox?filter=mine`
3. Confirmar que:
- o composer aparece
- a mensagem envia
- não aparece mais o aviso pedindo para assumir sem botão
- conversas realmente não atribuídas continuam exibindo “Assumir”

Detalhe técnico
- Estado inválido atual:
```text
assigned_to = usuário atual
ai_mode = waiting_human
```

- Estado correto após atribuição humana:
```text
assigned_to = usuário atual
ai_mode = copilot
```

<lov-actions>
<lov-suggestion message="Teste esse fluxo ponta a ponta: atribua uma conversa a um atendente, abra em Minhas e confirme que o composer libera o envio sem pedir para assumir novamente.">Verificar ponta a ponta</lov-suggestion>
<lov-suggestion message="Implemente a correção no distributor para que toda conversa atribuída a um agente entre automaticamente em modo Copilot.">Corrigir distribuição</lov-suggestion>
<lov-suggestion message="Adicione uma proteção no composer para permitir envio quando a conversa estiver waiting_human mas já atribuída ao próprio atendente.">Adicionar fallback no composer</lov-suggestion>
</lov-actions>
