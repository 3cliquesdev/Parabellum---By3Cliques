
Objetivo: corrigir de vez o erro do protocolo `#7BA56740`, onde após OTP validado o cliente envia a chave PIX numérica (`02461362270`) e a IA volta para a resposta genérica.

Diagnóstico confirmado:
1. O ajuste anterior ficou incompleto.
2. O `__ai_otp_verified` NÃO foi salvo no `chat_flow_states`.
3. Motivo técnico: o sync novo em `ai-autopilot-chat` depende de `flow_context.stateId`, mas `handle-whatsapp-event` não envia `stateId` no `flow_context`.
4. Evidência real da conversa:
   - `messages`: OTP sucesso às `03:58:30`, depois cliente manda `02461362270`, depois vem `Pode me contar com mais detalhes...`
   - `chat_flow_states.collected_data`: ainda não tem `__ai_otp_verified`
5. Há um segundo bug ativo:
   - `ai-autopilot-chat` trata qualquer mensagem só com dígitos como `isMenuNoise`
   - então uma chave PIX CPF numérica cai no atalho de “ruído de menu” e gera exatamente a resposta genérica que apareceu no caso real.

Plano de correção:
1. Propagar `stateId` corretamente para o `flow_context`
   - ajustar quem invoca `ai-autopilot-chat` para incluir o `stateId` atual do fluxo
   - assim o sync de `__ai_otp_verified` passa a funcionar de verdade

2. Blindar o sync pós-OTP
   - manter o update de `chat_flow_states.collected_data.__ai_otp_verified = true`
   - garantir log claro de sucesso/falha com `stateId`
   - opcionalmente também refletir `flow_context.otpVerified` no mesmo ciclo

3. Corrigir a falsa detecção de “menu noise”
   - hoje `^\d+$` classifica CPF/PIX numérico como ruído
   - ajustar a regra para não tratar mensagens numéricas longas como menu
   - manter menu noise apenas para respostas curtas de navegação, como `1`, `2`, `3`

4. Adicionar exceção explícita para coleta pós-OTP
   - se `flow_context?.otpVerified` ou `hasRecentOTPVerification` estiver ativo, desabilitar totalmente esse atalho de menu noise
   - isso evita regressão mesmo quando a chave PIX for CPF, telefone ou outro valor numérico

5. Revisar o fallback pós-OTP
   - garantir que, em contexto financeiro já validado, o fallback nunca responda “Pode me contar com mais detalhes...”
   - ele deve continuar a coleta: PIX → banco → valor → motivo

Validação após implementação:
1. Happy path
   - “quero sacar”
   - OTP
   - código válido
   - `02461362270`
   - esperado: pedir banco, sem resposta genérica

2. PIX numérica
   - após OTP, mandar CPF/telefone só com números
   - esperado: não cair em `isMenuNoise`

3. PIX email
   - após OTP, mandar `fulano@email.com`
   - esperado: continuar coleta normalmente

4. Conferência de estado
   - verificar que `chat_flow_states.collected_data` recebeu `__ai_otp_verified: true`

Resultado esperado:
- Sim, o mesmo erro anterior ainda pode acontecer.
- A causa principal agora está isolada: faltou propagar `stateId`, e a chave PIX numérica ainda está sendo confundida com opção de menu.
- Com esses dois ajustes, o fluxo deve ficar pronto para teste E2E real.
