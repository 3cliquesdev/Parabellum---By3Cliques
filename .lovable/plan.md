

# Fix: "permission denied for table users" ao criar devolução

## Causa Raiz
As políticas RLS `client_insert_returns` e `client_select_returns` fazem `SELECT email FROM auth.users` diretamente. Quando um `support_agent` tenta inserir na tabela `returns`, o PostgreSQL avalia **todas** as políticas (OR entre elas). As políticas de cliente falham porque o role `authenticated` não tem permissão de SELECT na tabela `auth.users` — gerando o erro.

## Solução
Criar uma função `SECURITY DEFINER` que retorna o email do usuário autenticado (contornando a restrição de acesso a `auth.users`), e atualizar as duas políticas de cliente para usar essa função.

### Migração SQL

1. Criar função helper:
```sql
CREATE OR REPLACE FUNCTION public.get_auth_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;
```

2. Recriar `client_insert_returns` usando `get_auth_email()` em vez de subquery em `auth.users`

3. Recriar `client_select_returns` usando `get_auth_email()` em vez de subquery em `auth.users`

### Impacto
- Zero alterações no frontend
- As políticas de agente e gerência continuam inalteradas
- O comportamento para clientes permanece idêntico, apenas a implementação interna muda

