

# Auditoria: Senha do Cliente e Recuperação de Senha

## Senha Inicial do Cliente

Quando um cliente é criado (via Kiwify sync), a senha temporária é:
- **Primeiros 5 dígitos do CPF** do cliente, ou `temp12345` se o CPF não existir
- A flag `must_change_password: true` é setada, forçando o cliente a ir para `/setup-password` no primeiro login

O problema: **o cliente nunca é informado dessa senha temporária**. O e-mail de boas-vindas contém um link de recovery, mas se esse link expirar (24h), o cliente fica sem saber a senha.

---

## Bug na Recuperação de Senha (o que você viu na screenshot)

O fluxo "Enviar link de redefinição" do portal (`/portal`) **aparenta funcionar** (mostra sucesso), mas o link recebido por email **falha** porque:

1. O `redirectTo` aponta para `/setup-password`
2. A página `/setup-password` **não detecta o token de recovery** do Supabase (hash `type=recovery`)
3. Em vez de ir direto para "Definir nova senha", ela mostra o fluxo de OTP em 3 etapas (enviar código → verificar → definir senha)
4. Se o usuário não tiver sessão ativa, `/setup-password` redireciona para `/auth` (login admin) em vez de `/portal` (login cliente)

## Plano de Correção

### Arquivo: `src/pages/SetupPassword.tsx`

**A) Detectar recovery token na URL** — Quando o Supabase redireciona com `type=recovery`, o usuário já está autenticado automaticamente. Detectar isso e pular direto para a etapa "set_password", eliminando o OTP desnecessário.

**B) Redirecionar clientes para `/portal`** — Se o usuário não estiver autenticado, verificar se veio de uma URL de cliente e redirecionar para `/portal` em vez de `/auth`.

### Arquivo: `src/pages/ClientLogin.tsx`

**C) Validação de email antes do reset** — Adicionar feedback caso o email não esteja cadastrado (atualmente o Supabase retorna sucesso mesmo para emails inexistentes por segurança, mas podemos melhorar o UX com uma mensagem mais clara).

### Resultado
- Cliente clica "Esqueci minha senha" → recebe email → clica no link → vai direto para "Definir nova senha" (sem OTP)
- Fluxo de primeiro acesso com `must_change_password` continua funcionando com OTP (segurança extra para contas novas)

