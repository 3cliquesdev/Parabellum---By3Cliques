-- Permitir ecommerce_analyst ver tickets atribuídos a ele, não atribuídos, ou que criou
CREATE POLICY "ecommerce_analyst_can_view_tickets" ON tickets
FOR SELECT
USING (
  has_role(auth.uid(), 'ecommerce_analyst'::app_role) AND (
    assigned_to = auth.uid() OR 
    assigned_to IS NULL OR 
    created_by = auth.uid()
  )
);

-- Permitir ecommerce_analyst atualizar tickets atribuídos a ele ou não atribuídos
CREATE POLICY "ecommerce_analyst_can_update_tickets" ON tickets
FOR UPDATE
USING (
  has_role(auth.uid(), 'ecommerce_analyst'::app_role) AND (
    assigned_to = auth.uid() OR 
    assigned_to IS NULL OR 
    created_by = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'ecommerce_analyst'::app_role) AND (
    assigned_to = auth.uid() OR 
    assigned_to IS NULL OR 
    created_by = auth.uid()
  )
);