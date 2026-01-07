-- Política RLS para financial_agent: ver tickets atribuídos a eles, não atribuídos, ou criados por eles
CREATE POLICY "financial_agent_can_view_tickets" ON public.tickets
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'financial_agent'::app_role) AND (
      assigned_to = auth.uid() OR 
      assigned_to IS NULL OR 
      created_by = auth.uid()
    )
  );

-- Política RLS para consultant: ver tickets de contatos que eles consultam ou criados por eles
CREATE POLICY "consultant_can_view_tickets" ON public.tickets
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'consultant'::app_role) AND (
      customer_id IN (
        SELECT id FROM public.contacts WHERE consultant_id = auth.uid()
      ) OR
      created_by = auth.uid()
    )
  );

-- Política RLS para user: ver apenas tickets que criaram
CREATE POLICY "user_can_view_own_tickets" ON public.tickets
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'user'::app_role) AND
    created_by = auth.uid()
  );