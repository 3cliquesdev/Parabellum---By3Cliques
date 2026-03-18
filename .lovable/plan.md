

# Problema: Mensagens da Fila IA invisíveis por RLS no `messages`

## Diagnóstico confirmado
As 4 conversas da IA aparecem na lista porque o `inbox_view` tem regras de visibilidade global para a fila IA. Porém, ao clicar numa conversa, as **mensagens voltam vazias** (confirmado nos network requests: `Response Body: []`).

A causa é a policy `role_based_select_messages` na tabela `messages`. Ela permite leitura apenas quando:
1. O usuário é admin/manager, OU
2. A conversa está atribuída ao próprio usuário (`assigned_to = auth.uid()`), OU
3. A conversa é `open`, sem responsável, o usuário tem role operacional, **E o departamento da conversa é igual ao do usuário ou NULL**

As conversas da IA estão em departamentos diferentes do Miguel:
- Conversas: Suporte (`36ce66cd`), Suporte Pedidos (`2dd0ee5c`), Customer Success (`b7149bf4`)
- Miguel: Suporte Sistema (`fd4fcc90`)

Como os departamentos não batem, a policy bloqueia a leitura das mensagens.

## Solução
Atualizar a policy `role_based_select_messages` para adicionar uma condição extra: se a conversa é da fila IA (`ai_mode` em `autopilot` ou `waiting_human`), sem responsável e aberta, atendentes operacionais podem ler as mensagens **independente do departamento**.

### Alteração: Migration SQL

Recriar a policy adicionando um OR para fila IA global:

```sql
DROP POLICY IF EXISTS "role_based_select_messages" ON public.messages;

CREATE POLICY "role_based_select_messages" ON public.messages
FOR SELECT TO authenticated
USING (
  is_manager_or_admin(auth.uid())
  OR (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
      AND c.assigned_to = auth.uid()
  ))
  OR (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
      AND c.status = 'open'
      AND c.assigned_to IS NULL
      AND has_any_role(auth.uid(), ARRAY['sales_rep','support_agent','financial_agent','consultant']::app_role[])
      AND (c.department = (SELECT p.department FROM profiles p WHERE p.id = auth.uid()) OR c.department IS NULL)
  ))
  OR (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
      AND c.status = 'open'
      AND c.assigned_to IS NULL
      AND c.ai_mode IN ('autopilot', 'waiting_human')
      AND has_any_role(auth.uid(), ARRAY['sales_rep','support_agent','financial_agent','consultant']::app_role[])
  ))
);
```

A nova condição (4o bloco OR) permite que qualquer atendente operacional leia mensagens de conversas da fila IA, sem restrição de departamento.

### Arquivos a alterar
- Nenhum arquivo frontend. Apenas uma migration SQL.

### Resultado esperado
Miguel (e outros atendentes) verão o conteúdo das conversas da fila IA imediatamente ao clicar.

