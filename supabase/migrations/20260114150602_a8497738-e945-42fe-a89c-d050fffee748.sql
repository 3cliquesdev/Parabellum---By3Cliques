-- Corrigir visibilidade de support_agent
-- Agora só vê: suas conversas atribuídas OU não atribuídas do departamento Suporte
DROP POLICY IF EXISTS support_agent_view_assigned_inbox ON inbox_view;

CREATE POLICY "support_agent_view_assigned_inbox" ON inbox_view
FOR SELECT USING (
  has_role(auth.uid(), 'support_agent'::app_role) AND (
    (assigned_to = auth.uid()) OR 
    (assigned_to IS NULL AND department IN (
      SELECT id FROM departments WHERE name = 'Suporte'
    ))
  )
);

-- Corrigir visibilidade de sales_rep
-- Agora só vê: suas conversas atribuídas OU não atribuídas do departamento Comercial/Vendas
DROP POLICY IF EXISTS sales_rep_view_sales_inbox ON inbox_view;

CREATE POLICY "sales_rep_view_sales_inbox" ON inbox_view
FOR SELECT USING (
  has_role(auth.uid(), 'sales_rep'::app_role) AND (
    (assigned_to = auth.uid()) OR 
    (assigned_to IS NULL AND department IN (
      SELECT id FROM departments WHERE name IN ('Comercial', 'Vendas')
    ))
  )
);