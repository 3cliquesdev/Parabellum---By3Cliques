

# Diagnóstico: Erro "Failed to send a request to the Edge Function"

## Problema Identificado

A Edge Function `check-user-status` **não está deployada** no ambiente de produção. Quando o usuário clica em "Continuar" no formulário de pre-chat, o frontend chama essa função mas recebe um **404 Not Found**.

**Evidência:**
```
Teste direto: POST /check-user-status
Resultado: 404 - "Requested function was not found"
```

**Outras funções testadas (funcionando):**
- `form-public-api` → 400 (ok, falta parâmetro)
- `send-verification-code` → 400 (ok, falta parâmetro)

## Causa Raiz

A função existe no código (`supabase/functions/check-user-status/index.ts`) e está configurada no `config.toml`, mas não foi implantada no servidor.

## Solução

**Deploy da Edge Function `check-user-status`**

A função já está corretamente implementada:
- Código: `supabase/functions/check-user-status/index.ts`
- Config: `verify_jwt = false` (correto para acesso público)
- CORS configurado corretamente

Preciso apenas deployar a função para que ela fique acessível.

## Impacto

Após o deploy:
1. Pre-chat do widget vai funcionar
2. Usuário poderá verificar email e iniciar conversa
3. Fluxo de OTP para clientes existentes funcionará
4. Fluxo de novo lead funcionará

## Ação

Deploy imediato da função `check-user-status`.

