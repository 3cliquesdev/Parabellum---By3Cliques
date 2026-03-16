

# Acesso do Cliente ao Portal — Situação Atual e Melhorias

## Fluxo Atual (funciona, mas não é ideal)

```text
Cliente acessa /client-portal
  → ProtectedRoute detecta: não autenticado
  → Redireciona para /auth (tela de login genérica/interna)
  → Cliente faz login com email + senha
  → Role "user" → redireciona para /client-portal
```

A senha é criada via email de boas-vindas enviado pelo webhook Kiwify, com link de recuperação que leva a `/setup-password`.

## Problema

A tela `/auth` é a mesma usada por agentes, admins e gestores. O cliente vê uma tela interna sem identidade visual voltada para ele. Não há rota amigável como `/portal`.

## Proposta: Tela de Login Dedicada para Clientes

### 1. Criar rota `/portal` (alias amigável)
- Rota pública que renderiza uma tela de login dedicada para clientes
- Visual limpo, com logo da Parabellum e cores do portal (gradiente azul/roxo)
- Campos: email + senha + botão "Entrar"
- Link "Esqueci minha senha" funcional
- Após login com role `user`, redireciona para `/client-portal`
- Se role diferente de `user`, redireciona para a home do role normalmente

### 2. Criar componente `ClientLogin.tsx`
- Tela independente da `/auth` interna
- Layout mobile-first, card centralizado
- Reutiliza a mesma lógica de autenticação (`supabase.auth.signInWithPassword`)
- Badge "Portal do Cliente" no topo

### 3. Atualizar `App.tsx`
- Adicionar rota pública: `/portal` → `<ClientLogin />`

### Arquivos

| Arquivo | Acao |
|---------|------|
| `src/pages/ClientLogin.tsx` | Criar — Tela de login dedicada para clientes |
| `src/App.tsx` | Modificar — Adicionar rota `/portal` |

O link que o cliente usará será: **parabellum.work/portal**

