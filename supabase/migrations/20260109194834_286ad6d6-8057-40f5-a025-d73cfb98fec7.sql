-- Atualizar política de email_templates para incluir cs_manager
DROP POLICY IF EXISTS "admins_managers_can_manage_email_templates" ON public.email_templates;

CREATE POLICY "admins_managers_cs_can_manage_email_templates" 
ON public.email_templates 
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role)
);

-- Atualizar política de email_template_blocks para incluir cs_manager
DROP POLICY IF EXISTS "admin_manager_full_access_blocks" ON public.email_template_blocks;

CREATE POLICY "admin_manager_cs_full_access_blocks" 
ON public.email_template_blocks 
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role)
);

-- Atualizar política de email_template_variants para incluir cs_manager
DROP POLICY IF EXISTS "admin_manager_full_access_variants" ON public.email_template_variants;

CREATE POLICY "admin_manager_cs_full_access_variants" 
ON public.email_template_variants 
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role)
);

-- Atualizar política de email_template_translations para incluir cs_manager
DROP POLICY IF EXISTS "admin_manager_full_access_translations" ON public.email_template_translations;

CREATE POLICY "admin_manager_cs_full_access_translations" 
ON public.email_template_translations 
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role)
);