

# Upgrade: RLS agent_departments -- Bloquear clientes, liberar apenas internos

## Contexto

O role `user` e exclusivamente para clientes externos. Eles acessam apenas `/client-portal` e nao devem ter visibilidade alguma sobre agentes, departamentos ou estrutura interna da equipe.

## Mudanca

### SQL Migration

Substituir a politica atual (muito permissiva) por uma que so libera leitura para funcionarios internos:

```sql
-- Remover politica permissiva atual
DROP POLICY IF EXISTS "Authenticated users can read agent_departments" 
  ON public.agent_departments;

-- Politica segura: apenas internos
CREATE POLICY "can_read_agent_departments_for_transfer"
ON public.agent_departments
FOR SELECT
TO authenticated
USING (
  -- Gestores veem tudo
  public.has_any_role(
    auth.uid(),
    ARRAY['admin','manager','general_manager',
          'support_manager','cs_manager','financial_manager']::app_role[]
  )
  OR
  -- Operacionais com permissao de transferir veem agentes do departamento
  EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role::text = rp.role
    WHERE ur.user_id = auth.uid()
      AND rp.permission_key = 'inbox.transfer'
      AND rp.enabled = true
  )
);
```

**Removido** o fallback `department_id = profiles.department` porque:
- Clientes (`user`) nao tem departamento operacional
- Se um agente interno nao tem `inbox.transfer`, ele nao precisa ver a lista de agentes de outros departamentos
- A politica existente `"Agents can read own departments"` (`profile_id = auth.uid()`) ja garante que cada agente veja seus proprios vinculos

### Frontend

Nenhuma mudanca necessaria. O componente `TransferConversationDialog.tsx` ja esta correto com `onlineOnly: false`, badges de status e agrupamento.

## Resumo de Acesso

| Perfil | Acesso a agent_departments |
|--------|---------------------------|
| admin/manager/gestores | Leitura total |
| sales_rep/support_agent com inbox.transfer | Leitura total (para transferir) |
| Agente sem inbox.transfer | Ve apenas seus proprios vinculos (politica existente) |
| user (cliente) | Zero acesso -- completamente bloqueado |

## Impacto

- Zero regressao no frontend
- Clientes ficam 100% bloqueados de ver dados internos
- Agentes com permissao de transfer continuam vendo a lista normalmente
- Politicas de escrita (managers) permanecem inalteradas

## Testes

- Logar como Thaynara (sales_rep com inbox.transfer) -- deve ver agentes no dialog
- Logar como admin -- deve continuar funcionando
- Confirmar que role user nao consegue ler agent_departments (retorno vazio)
- Console sem erros
