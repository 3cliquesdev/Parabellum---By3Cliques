
Objetivo: corrigir o caso em que, após validar o OTP no fluxo financeiro, a conversa ainda responde com a mensagem genérica “✅ Identidade verificada com sucesso...” em vez do template de coleta PIX.

1. Confirmar a causa real no pipeline
- Validar a propagação do `flow_context.ticketConfig` desde o motor de fluxo até o `ai-autopilot-chat`.
- Hoje o banco mostra que o nó `node_ia_financeiro` tem `ticket_config.description_template`, mas os logs mostram `POST-OTP SAQUE — primeira interação sem template`, o que indica que esse template não está chegando ao runtime do Autopilot naquele momento.

2. Auditar os pontos de passagem do contexto
- Revisar o caminho completo:
  - `process-chat-flow` monta `ticketConfig`
  - webhook/buffer preserva `flow_context`
  - `process-buffered-messages`/invocações internas repassam esse contexto
  - `ai-autopilot-chat` recebe `flow_context.ticketConfig`
- Procurar especialmente qualquer serialização, merge ou fallback que esteja removendo `ticketConfig` ou sobrescrevendo `flow_context`.

3. Endurecer a resposta pós-OTP
- Ajustar o `ai-autopilot-chat` para que, quando o OTP for validado em contexto de saque/reembolso, ele envie o template de coleta de forma determinística e imediata.
- A regra deve ser:
  - se houver `ticketConfig.description_template` → responder com `buildCollectionMessage(...)` diretamente
  - se não houver template, mas houver `smartCollectionFields` → usar o helper de coleta
  - nunca cair na mensagem genérica se a intenção financeira já estiver confirmada

4. Adicionar fallback defensivo
- Mesmo se `ticketConfig` vier ausente por algum motivo, usar o estado do nó financeiro (`smartCollectionEnabled` / `smartCollectionFields` / objetivo do nó) para disparar a coleta após OTP.
- Isso evita depender de uma única propriedade para continuar o fluxo.

5. Melhorar observabilidade
- Incluir logs objetivos para depuração:
  - `flow_context.ticketConfig received: true/false`
  - `description_template present: true/false`
  - `post_otp_response_mode: template | smart_fields | generic`
- Assim fica claro se o problema é deploy, contexto faltando ou decisão errada da função.

6. Validação após correção
- Reproduzir exatamente o fluxo:
  - menu produto
  - menu financeiro
  - “quero sacar”
  - OTP correto
- Confirmar que a próxima mensagem já é o template de coleta PIX e não a mensagem genérica.
- Validar também o caso seguinte: envio dos dados, criação do ticket e continuidade/encerramento do fluxo.

Detalhes técnicos
- Evidência já confirmada:
  - o nó financeiro no banco tem `ticket_config.description_template`
  - o `chat_flow_state` da conversa tem `__ai_otp_verified: true`
  - os logs do `ai-autopilot-chat` mostram ausência prática do template no momento da decisão
- Isso aponta mais para falha de propagação/uso do `flow_context` do que para configuração do fluxo em si.
- A correção principal deve focar no pipeline do contexto e no bypass determinístico pós-OTP.

Resultado esperado
- OTP válido em fluxo financeiro leva imediatamente à coleta estruturada do saque.
- A mensagem genérica de “identidade verificada” deixa de aparecer como resposta final nesse cenário.
- O fluxo volta a seguir a sequência correta: OTP → coleta PIX → ticket → encerramento/tag.

<lov-actions>
<lov-suggestion message="Teste o fluxo de saque end-to-end no WhatsApp para confirmar que após o OTP o template PIX é enviado imediatamente">Verifique ponta a ponta</lov-suggestion>
<lov-suggestion message="Implemente a correção no pipeline de flow_context para garantir que ticketConfig.description_template chegue sempre ao ai-autopilot-chat">Corrigir propagação do contexto</lov-suggestion>
<lov-suggestion message="Adicione logs estruturados no ai-autopilot-chat para mostrar se ticketConfig e description_template chegaram no pós-OTP">Melhorar logs do pós-OTP</lov-suggestion>
</lov-actions>
