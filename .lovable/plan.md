

# Liberar Gerentes para Mapear Ofertas (product_offers)

## Problema

A tabela `product_offers` tem a policy de escrita `admin_manager_can_manage_product_offers` que usa:
```sql
has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
```

Isso exclui `cs_manager`, `support_manager`, `financial_manager`, `general_manager` — o mesmo problema que corrigimos nas outras 5 tabelas.

## Correção

Uma migration:

```sql
DROP POLICY IF EXISTS "admin_manager_can_manage_product_offers" ON public.product_offers;

CREATE POLICY "managers_can_manage_product_offers"
ON public.product_offers
FOR ALL
TO authenticated
USING (public.is_manager_or_admin(auth.uid()))
WITH CHECK (public.is_manager_or_admin(auth.uid()));
```

Zero alterações de código frontend. A policy de SELECT (`authenticated_can_view_product_offers`) permanece inalterada.

