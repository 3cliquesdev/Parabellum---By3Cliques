

# Plano: Mensagens de Sucesso e Falha OTP

## Alterações

### 1. Frontend — `BehaviorControlsSection.tsx` (L475-515)

Adicionar 2 campos editáveis dentro da seção OTP expandida (quando `require_otp_for_financial = true`):

- **"Mensagem OTP verificado"** — default: `"✅ Verificação concluída! Agora vou processar sua solicitação."`  
  Campo: `otp_message_verified`

- **"Mensagem OTP falhou"** — default: `"Não foi possível verificar. Vou te encaminhar para um atendente."`  
  Campo: `otp_message_failed`

Posicionados entre o campo "Mensagem quando OTP enviado" e "Máximo de tentativas".

### 2. Backend — `process-chat-flow/index.ts`

- **OTP sucesso (~L3276):** Enviar `otp_message_verified` (ou default) como mensagem ao cliente antes de avançar para o nó `otp_verified`
- **OTP falha (~L3440):** Enviar `otp_message_failed` (ou default) como mensagem ao cliente antes de avançar para o nó `otp_failed`

