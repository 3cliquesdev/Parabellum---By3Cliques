

# Fix: Consultant não consegue atribuir/atualizar tickets

## Diagnóstico

- `luiz.silva@3cliques.net` tem apenas o role `consultant`
- A política `canonical_update_tickets` permite UPDATE apenas para:
  - Gestores (admin, manager, etc.)
  - `assigned_to = auth.uid()` (ticket atribuído a ele)
  - `created_by = auth.uid()` (ticket criado por ele)
- Consultores podem VER tickets dos seus clientes (via `get_consultant_contact_ids`), mas não podem ATUALIZAR esses tickets
- Resultado: ao tentar atribuir um ticket, recebe erro de RLS

## Solução

Atualizar a política `canonical_update_tickets` para incluir consultores que tenham visibilidade sobre o ticket (mesma lógica do SELECT):

| Arquivo/Recurso | Mudança |
|---|---|
| Migration SQL | Recriar `canonical_update_tickets` adicionando a condição de consultant ao USING e WITH CHECK |

### SQL da migration

```sql
DROP POLICY IF EXISTS "canonical_update_tickets" ON public.tickets;

CREATE POLICY "canonical_update_tickets" ON public.tickets
FOR UPDATE TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['admin','manager','general_manager','support_manager','cs_manager','financial_manager']::app_role[])
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR (
    has_any_role(auth.uid(), ARRAY['consultant']::app_role[])
    AND customer_id IN (SELECT get_consultant_contact_ids(auth.uid()))
  )
)
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['admin','manager','general_manager','support_manager','cs_manager','financial_manager']::app_role[])
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR (
    has_any_role(auth.uid(), ARRAY['consultant']::app_role[])
    AND customer_id IN (SELECT get_consultant_contact_ids(auth.uid()))
  )
);
```

Isso permite que consultores atualizem (incluindo atribuir) tickets cujos clientes estão na sua carteira, mantendo a mesma lógica de visibilidade já usada no SELECT.

