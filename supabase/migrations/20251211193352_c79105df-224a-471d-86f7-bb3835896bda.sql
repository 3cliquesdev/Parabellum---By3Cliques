-- Adicionar permissões que faltam para o menu dinâmico
-- Cada role deve ter todas as permissões listadas no menu

-- Lista de novas permissões necessárias
DO $$
DECLARE
  roles_list TEXT[] := ARRAY['admin', 'manager', 'general_manager', 'sales_rep', 'consultant', 'support_agent', 'support_manager', 'financial_manager', 'cs_manager'];
  r TEXT;
  perm RECORD;
BEGIN
  -- Definir todas as permissões necessárias para o menu
  FOR perm IN (
    SELECT * FROM (VALUES
      -- Dashboard & Overview
      ('dashboard.view', 'Ver dashboard', 'dashboard'),
      ('sales.view_management', 'Ver gestão de vendas', 'sales'),
      ('sales.view_workzone', 'Ver workzone de vendas', 'sales'),
      
      -- Inbox
      ('inbox.access', 'Acessar inbox', 'inbox'),
      ('inbox.view_knowledge', 'Ver base de conhecimento', 'inbox'),
      
      -- Deals
      ('deals.view', 'Ver negócios', 'deals'),
      
      -- Quotes
      ('quotes.view', 'Ver propostas', 'quotes'),
      
      -- Contacts
      ('contacts.view_organizations', 'Ver organizações', 'contacts'),
      
      -- Goals
      ('goals.set', 'Definir metas', 'goals'),
      
      -- Settings
      ('settings.view', 'Ver configurações', 'settings'),
      ('settings.manage_users', 'Gerenciar usuários', 'settings')
    ) AS t(key, label, category)
  ) LOOP
    -- Para cada role
    FOREACH r IN ARRAY roles_list LOOP
      -- Inserir se não existe
      INSERT INTO role_permissions (role, permission_key, permission_label, permission_category, enabled)
      VALUES (
        r::app_role, 
        perm.key, 
        perm.label, 
        perm.category,
        -- Definir enabled baseado no role
        CASE 
          WHEN r = 'admin' THEN true
          WHEN r = 'general_manager' THEN true
          WHEN r = 'manager' AND perm.key IN ('dashboard.view', 'sales.view_management', 'inbox.access', 'deals.view', 'quotes.view', 'contacts.view_organizations', 'goals.set', 'settings.view') THEN true
          WHEN r = 'sales_rep' AND perm.key IN ('dashboard.view', 'inbox.access', 'deals.view', 'quotes.view', 'contacts.view_organizations', 'sales.view_workzone') THEN true
          WHEN r = 'consultant' AND perm.key IN ('inbox.access', 'contacts.view') THEN true
          WHEN r = 'support_agent' AND perm.key IN ('inbox.access', 'inbox.view_knowledge', 'contacts.view') THEN true
          WHEN r = 'support_manager' AND perm.key IN ('inbox.access', 'inbox.view_knowledge', 'contacts.view', 'goals.set') THEN true
          WHEN r = 'financial_manager' AND perm.key IN ('inbox.access', 'quotes.view', 'contacts.view') THEN true
          WHEN r = 'cs_manager' AND perm.key IN ('inbox.access', 'contacts.view', 'goals.set') THEN true
          ELSE false
        END
      )
      ON CONFLICT (role, permission_key) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Garantir que permissões existentes estejam habilitadas corretamente para admin/general_manager
UPDATE role_permissions 
SET enabled = true 
WHERE role IN ('admin', 'general_manager');