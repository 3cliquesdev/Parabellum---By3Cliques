-- FASE 1: Corrigir RLS da tabela pipelines
DROP POLICY IF EXISTS admins_can_manage_pipelines ON pipelines;

CREATE POLICY managers_can_manage_pipelines ON pipelines
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'general_manager'::app_role) OR
    has_role(auth.uid(), 'support_manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'general_manager'::app_role) OR
    has_role(auth.uid(), 'support_manager'::app_role)
  );

-- FASE 2: Corrigir RLS de contacts para incluir general_manager
DROP POLICY IF EXISTS role_based_select_contacts ON contacts;
DROP POLICY IF EXISTS role_based_insert_contacts ON contacts;
DROP POLICY IF EXISTS role_based_update_contacts ON contacts;
DROP POLICY IF EXISTS role_based_delete_contacts ON contacts;

CREATE POLICY role_based_select_contacts ON contacts FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  (has_role(auth.uid(), 'sales_rep'::app_role) AND assigned_to = auth.uid())
);

CREATE POLICY role_based_insert_contacts ON contacts FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  (has_role(auth.uid(), 'sales_rep'::app_role) AND (assigned_to = auth.uid() OR assigned_to IS NULL))
);

CREATE POLICY role_based_update_contacts ON contacts FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'general_manager'::app_role) OR
    (has_role(auth.uid(), 'sales_rep'::app_role) AND assigned_to = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'general_manager'::app_role) OR
    (has_role(auth.uid(), 'sales_rep'::app_role) AND (assigned_to = auth.uid() OR assigned_to IS NULL))
  );

CREATE POLICY role_based_delete_contacts ON contacts FOR DELETE TO authenticated USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role)
);

-- FASE 2b: Corrigir RLS de deals para incluir general_manager
DROP POLICY IF EXISTS role_based_select_deals ON deals;
DROP POLICY IF EXISTS role_based_insert_deals ON deals;
DROP POLICY IF EXISTS role_based_update_deals ON deals;
DROP POLICY IF EXISTS role_based_delete_deals ON deals;

CREATE POLICY role_based_select_deals ON deals FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  (has_role(auth.uid(), 'sales_rep'::app_role) AND assigned_to = auth.uid())
);

CREATE POLICY role_based_insert_deals ON deals FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  (has_role(auth.uid(), 'sales_rep'::app_role) AND (assigned_to = auth.uid() OR assigned_to IS NULL))
);

CREATE POLICY role_based_update_deals ON deals FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'general_manager'::app_role) OR
    (has_role(auth.uid(), 'sales_rep'::app_role) AND assigned_to = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'general_manager'::app_role) OR
    (has_role(auth.uid(), 'sales_rep'::app_role) AND (assigned_to = auth.uid() OR assigned_to IS NULL))
  );

CREATE POLICY role_based_delete_deals ON deals FOR DELETE TO authenticated USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role)
);

-- FASE 2c: Corrigir RLS de organizations para incluir general_manager
DROP POLICY IF EXISTS role_based_select_organizations ON organizations;
DROP POLICY IF EXISTS role_based_insert_organizations ON organizations;
DROP POLICY IF EXISTS role_based_update_organizations ON organizations;
DROP POLICY IF EXISTS role_based_delete_organizations ON organizations;

CREATE POLICY role_based_select_organizations ON organizations FOR SELECT TO authenticated USING (true);

CREATE POLICY role_based_insert_organizations ON organizations FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role)
);

CREATE POLICY role_based_update_organizations ON organizations FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'general_manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'general_manager'::app_role)
  );

CREATE POLICY role_based_delete_organizations ON organizations FOR DELETE TO authenticated USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role)
);