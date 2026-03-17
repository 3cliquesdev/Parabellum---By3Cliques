
# Liberar Criação de Devoluções para Agentes (support_agent)

## Problema
A tabela `returns` possui apenas 2 políticas de INSERT:
- `client_insert_returns`: permite apenas clientes (`created_by = 'customer'`)
- `mgmt_all_returns`: permite apenas managers/admins via `is_manager_or_admin()`

O usuário `quila@3cliques.net` tem role `support_agent`, que não é coberto por nenhuma dessas políticas. Logo, o INSERT falha com erro de RLS.

## Solução
Adicionar uma nova política RLS de INSERT (e SELECT/UPDATE) para agentes operacionais na tabela `returns`.

### Migração SQL
Criar política `agent_manage_returns` que permite `support_agent`, `financial_agent`, `consultant` e `sales_rep` fazerem INSERT, SELECT e UPDATE na tabela `returns`:

```sql
CREATE POLICY "agent_manage_returns" ON public.returns
FOR ALL TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['support_agent','financial_agent','consultant','sales_rep']::app_role[])
)
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['support_agent','financial_agent','consultant','sales_rep']::app_role[])
);
```

Isso permite que qualquer agente autenticado (não-cliente, não-manager) crie e gerencie devoluções.

### Zero alterações no frontend
O código já usa `created_by: "admin"` no insert — isso é um campo de texto descritivo, não afeta a política. A política nova vai simplesmente permitir o INSERT baseado no role do usuário.
