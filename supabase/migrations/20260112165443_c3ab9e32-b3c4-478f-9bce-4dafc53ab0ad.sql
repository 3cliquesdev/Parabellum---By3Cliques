-- Correção 1: Atualizar RLS da tabela email_templates_v2 para incluir cs_manager e support_manager
DROP POLICY IF EXISTS "admin_manager_full_access_templates_v2" ON email_templates_v2;

CREATE POLICY "authorized_roles_full_access_templates_v2" ON email_templates_v2
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- Correção 2: Atualizar RLS da tabela email_branding para incluir cs_manager e support_manager
DROP POLICY IF EXISTS "admin_manager_can_manage_email_branding" ON email_branding;

CREATE POLICY "authorized_roles_can_manage_email_branding" ON email_branding
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- Correção 3: Atualizar RLS da tabela email_senders para incluir cs_manager e support_manager
DROP POLICY IF EXISTS "admin_manager_can_manage_email_senders" ON email_senders;

CREATE POLICY "authorized_roles_can_manage_email_senders" ON email_senders
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- Correção 4: Atualizar RLS da tabela email_layout_library para incluir cs_manager e support_manager
DROP POLICY IF EXISTS "admin_manager_manage_layouts" ON email_layout_library;

CREATE POLICY "authorized_roles_manage_layouts" ON email_layout_library
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);