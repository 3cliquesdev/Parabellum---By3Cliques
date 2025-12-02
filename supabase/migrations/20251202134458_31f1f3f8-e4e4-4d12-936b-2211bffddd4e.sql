-- Create role_permissions table for configurable permissions per role
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_key TEXT NOT NULL,
  permission_label TEXT NOT NULL,
  permission_category TEXT NOT NULL DEFAULT 'general',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, permission_key)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read permissions
CREATE POLICY "Anyone can read permissions" 
ON public.role_permissions 
FOR SELECT 
TO authenticated 
USING (true);

-- Only admin can modify permissions
CREATE POLICY "Only admin can modify permissions" 
ON public.role_permissions 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial permissions for all roles
-- Permission categories: deals, dashboard, knowledge, cadences, users, products, reports

-- ADMIN permissions (all enabled)
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled) VALUES
('admin', 'deals.view_all', 'Ver todos os negócios', 'deals', true),
('admin', 'deals.filter_by_rep', 'Filtrar por vendedor', 'deals', true),
('admin', 'deals.manage_pipelines', 'Gerenciar pipelines', 'deals', true),
('admin', 'deals.manage_stages', 'Gerenciar estágios', 'deals', true),
('admin', 'deals.view_pending_queue', 'Ver fila pendente', 'deals', true),
('admin', 'deals.set_goals', 'Definir metas de vendas', 'deals', true),
('admin', 'dashboard.manager_view', 'Dashboard de gerente', 'dashboard', true),
('admin', 'knowledge.manage_articles', 'Gerenciar artigos KB', 'knowledge', true),
('admin', 'cadences.manage', 'Gerenciar cadências', 'cadences', true),
('admin', 'users.manage', 'Gerenciar usuários', 'users', true),
('admin', 'products.manage', 'Gerenciar produtos', 'products', true),
('admin', 'reports.access', 'Acessar relatórios', 'reports', true);

-- GENERAL_MANAGER permissions
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled) VALUES
('general_manager', 'deals.view_all', 'Ver todos os negócios', 'deals', true),
('general_manager', 'deals.filter_by_rep', 'Filtrar por vendedor', 'deals', true),
('general_manager', 'deals.manage_pipelines', 'Gerenciar pipelines', 'deals', true),
('general_manager', 'deals.manage_stages', 'Gerenciar estágios', 'deals', true),
('general_manager', 'deals.view_pending_queue', 'Ver fila pendente', 'deals', true),
('general_manager', 'deals.set_goals', 'Definir metas de vendas', 'deals', true),
('general_manager', 'dashboard.manager_view', 'Dashboard de gerente', 'dashboard', true),
('general_manager', 'knowledge.manage_articles', 'Gerenciar artigos KB', 'knowledge', true),
('general_manager', 'cadences.manage', 'Gerenciar cadências', 'cadences', true),
('general_manager', 'users.manage', 'Gerenciar usuários', 'users', true),
('general_manager', 'products.manage', 'Gerenciar produtos', 'products', true),
('general_manager', 'reports.access', 'Acessar relatórios', 'reports', true);

-- MANAGER permissions
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled) VALUES
('manager', 'deals.view_all', 'Ver todos os negócios', 'deals', true),
('manager', 'deals.filter_by_rep', 'Filtrar por vendedor', 'deals', true),
('manager', 'deals.manage_pipelines', 'Gerenciar pipelines', 'deals', false),
('manager', 'deals.manage_stages', 'Gerenciar estágios', 'deals', false),
('manager', 'deals.view_pending_queue', 'Ver fila pendente', 'deals', true),
('manager', 'deals.set_goals', 'Definir metas de vendas', 'deals', true),
('manager', 'dashboard.manager_view', 'Dashboard de gerente', 'dashboard', true),
('manager', 'knowledge.manage_articles', 'Gerenciar artigos KB', 'knowledge', true),
('manager', 'cadences.manage', 'Gerenciar cadências', 'cadences', true),
('manager', 'users.manage', 'Gerenciar usuários', 'users', false),
('manager', 'products.manage', 'Gerenciar produtos', 'products', true),
('manager', 'reports.access', 'Acessar relatórios', 'reports', true);

-- SALES_REP permissions
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled) VALUES
('sales_rep', 'deals.view_all', 'Ver todos os negócios', 'deals', false),
('sales_rep', 'deals.filter_by_rep', 'Filtrar por vendedor', 'deals', false),
('sales_rep', 'deals.manage_pipelines', 'Gerenciar pipelines', 'deals', false),
('sales_rep', 'deals.manage_stages', 'Gerenciar estágios', 'deals', false),
('sales_rep', 'deals.view_pending_queue', 'Ver fila pendente', 'deals', false),
('sales_rep', 'deals.set_goals', 'Definir metas de vendas', 'deals', false),
('sales_rep', 'dashboard.manager_view', 'Dashboard de gerente', 'dashboard', false),
('sales_rep', 'knowledge.manage_articles', 'Gerenciar artigos KB', 'knowledge', false),
('sales_rep', 'cadences.manage', 'Gerenciar cadências', 'cadences', false),
('sales_rep', 'users.manage', 'Gerenciar usuários', 'users', false),
('sales_rep', 'products.manage', 'Gerenciar produtos', 'products', false),
('sales_rep', 'reports.access', 'Acessar relatórios', 'reports', false);

-- CONSULTANT permissions
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled) VALUES
('consultant', 'deals.view_all', 'Ver todos os negócios', 'deals', false),
('consultant', 'deals.filter_by_rep', 'Filtrar por vendedor', 'deals', false),
('consultant', 'deals.manage_pipelines', 'Gerenciar pipelines', 'deals', false),
('consultant', 'deals.manage_stages', 'Gerenciar estágios', 'deals', false),
('consultant', 'deals.view_pending_queue', 'Ver fila pendente', 'deals', false),
('consultant', 'deals.set_goals', 'Definir metas de vendas', 'deals', false),
('consultant', 'dashboard.manager_view', 'Dashboard de gerente', 'dashboard', false),
('consultant', 'knowledge.manage_articles', 'Gerenciar artigos KB', 'knowledge', false),
('consultant', 'cadences.manage', 'Gerenciar cadências', 'cadences', false),
('consultant', 'users.manage', 'Gerenciar usuários', 'users', false),
('consultant', 'products.manage', 'Gerenciar produtos', 'products', false),
('consultant', 'reports.access', 'Acessar relatórios', 'reports', false);

-- SUPPORT_AGENT permissions
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled) VALUES
('support_agent', 'deals.view_all', 'Ver todos os negócios', 'deals', false),
('support_agent', 'deals.filter_by_rep', 'Filtrar por vendedor', 'deals', false),
('support_agent', 'deals.manage_pipelines', 'Gerenciar pipelines', 'deals', false),
('support_agent', 'deals.manage_stages', 'Gerenciar estágios', 'deals', false),
('support_agent', 'deals.view_pending_queue', 'Ver fila pendente', 'deals', false),
('support_agent', 'deals.set_goals', 'Definir metas de vendas', 'deals', false),
('support_agent', 'dashboard.manager_view', 'Dashboard de gerente', 'dashboard', false),
('support_agent', 'knowledge.manage_articles', 'Gerenciar artigos KB', 'knowledge', false),
('support_agent', 'cadences.manage', 'Gerenciar cadências', 'cadences', false),
('support_agent', 'users.manage', 'Gerenciar usuários', 'users', false),
('support_agent', 'products.manage', 'Gerenciar produtos', 'products', false),
('support_agent', 'reports.access', 'Acessar relatórios', 'reports', false);

-- SUPPORT_MANAGER permissions
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled) VALUES
('support_manager', 'deals.view_all', 'Ver todos os negócios', 'deals', false),
('support_manager', 'deals.filter_by_rep', 'Filtrar por vendedor', 'deals', false),
('support_manager', 'deals.manage_pipelines', 'Gerenciar pipelines', 'deals', false),
('support_manager', 'deals.manage_stages', 'Gerenciar estágios', 'deals', false),
('support_manager', 'deals.view_pending_queue', 'Ver fila pendente', 'deals', false),
('support_manager', 'deals.set_goals', 'Definir metas de vendas', 'deals', false),
('support_manager', 'dashboard.manager_view', 'Dashboard de gerente', 'dashboard', true),
('support_manager', 'knowledge.manage_articles', 'Gerenciar artigos KB', 'knowledge', true),
('support_manager', 'cadences.manage', 'Gerenciar cadências', 'cadences', false),
('support_manager', 'users.manage', 'Gerenciar usuários', 'users', false),
('support_manager', 'products.manage', 'Gerenciar produtos', 'products', false),
('support_manager', 'reports.access', 'Acessar relatórios', 'reports', true);

-- FINANCIAL_MANAGER permissions
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled) VALUES
('financial_manager', 'deals.view_all', 'Ver todos os negócios', 'deals', true),
('financial_manager', 'deals.filter_by_rep', 'Filtrar por vendedor', 'deals', true),
('financial_manager', 'deals.manage_pipelines', 'Gerenciar pipelines', 'deals', false),
('financial_manager', 'deals.manage_stages', 'Gerenciar estágios', 'deals', false),
('financial_manager', 'deals.view_pending_queue', 'Ver fila pendente', 'deals', false),
('financial_manager', 'deals.set_goals', 'Definir metas de vendas', 'deals', false),
('financial_manager', 'dashboard.manager_view', 'Dashboard de gerente', 'dashboard', true),
('financial_manager', 'knowledge.manage_articles', 'Gerenciar artigos KB', 'knowledge', false),
('financial_manager', 'cadences.manage', 'Gerenciar cadências', 'cadences', false),
('financial_manager', 'users.manage', 'Gerenciar usuários', 'users', false),
('financial_manager', 'products.manage', 'Gerenciar produtos', 'products', false),
('financial_manager', 'reports.access', 'Acessar relatórios', 'reports', true);

-- CS_MANAGER permissions
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled) VALUES
('cs_manager', 'deals.view_all', 'Ver todos os negócios', 'deals', true),
('cs_manager', 'deals.filter_by_rep', 'Filtrar por vendedor', 'deals', true),
('cs_manager', 'deals.manage_pipelines', 'Gerenciar pipelines', 'deals', false),
('cs_manager', 'deals.manage_stages', 'Gerenciar estágios', 'deals', false),
('cs_manager', 'deals.view_pending_queue', 'Ver fila pendente', 'deals', false),
('cs_manager', 'deals.set_goals', 'Definir metas de vendas', 'deals', true),
('cs_manager', 'dashboard.manager_view', 'Dashboard de gerente', 'dashboard', true),
('cs_manager', 'knowledge.manage_articles', 'Gerenciar artigos KB', 'knowledge', true),
('cs_manager', 'cadences.manage', 'Gerenciar cadências', 'cadences', true),
('cs_manager', 'users.manage', 'Gerenciar usuários', 'users', false),
('cs_manager', 'products.manage', 'Gerenciar produtos', 'products', false),
('cs_manager', 'reports.access', 'Acessar relatórios', 'reports', true);