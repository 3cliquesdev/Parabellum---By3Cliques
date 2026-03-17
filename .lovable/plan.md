

# Deploy das Edge Functions: send-recovery-email e auth-email-hook

## O que será feito
Deploy das duas Edge Functions que foram criadas/alteradas recentemente para que fiquem ativas em produção:

1. **send-recovery-email** -- Envia email de recuperação de senha via Resend com template branded do Parabellum
2. **auth-email-hook** -- Hook de autenticação para interceptar emails do sistema de auth

## Execução
Chamar o deploy para ambas as functions em uma única operação.

