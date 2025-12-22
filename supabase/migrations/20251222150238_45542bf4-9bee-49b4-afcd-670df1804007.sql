-- Atualizar políticas RLS para incluir TODOS os managers nas tabelas de formulários

-- =====================================================
-- TABELA: forms
-- =====================================================

-- DROP políticas existentes
DROP POLICY IF EXISTS "Managers can create forms" ON public.forms;
DROP POLICY IF EXISTS "Managers can update forms" ON public.forms;
DROP POLICY IF EXISTS "Managers can delete forms" ON public.forms;

-- NOVA política INSERT - inclui cs_manager e financial_manager
CREATE POLICY "Managers can create forms" ON public.forms
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'general_manager') OR
    public.has_role(auth.uid(), 'support_manager') OR
    public.has_role(auth.uid(), 'cs_manager') OR
    public.has_role(auth.uid(), 'financial_manager')
  );

-- NOVA política UPDATE - inclui cs_manager e financial_manager
CREATE POLICY "Managers can update forms" ON public.forms
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'general_manager') OR
    public.has_role(auth.uid(), 'support_manager') OR
    public.has_role(auth.uid(), 'cs_manager') OR
    public.has_role(auth.uid(), 'financial_manager')
  );

-- NOVA política DELETE - inclui cs_manager e financial_manager
CREATE POLICY "Managers can delete forms" ON public.forms
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'general_manager') OR
    public.has_role(auth.uid(), 'support_manager') OR
    public.has_role(auth.uid(), 'cs_manager') OR
    public.has_role(auth.uid(), 'financial_manager')
  );

-- =====================================================
-- TABELA: form_conditions
-- =====================================================

DROP POLICY IF EXISTS "Managers can create form conditions" ON public.form_conditions;
DROP POLICY IF EXISTS "Managers can update form conditions" ON public.form_conditions;
DROP POLICY IF EXISTS "Managers can delete form conditions" ON public.form_conditions;

CREATE POLICY "Managers can create form conditions" ON public.form_conditions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'general_manager') OR
    public.has_role(auth.uid(), 'support_manager') OR
    public.has_role(auth.uid(), 'cs_manager') OR
    public.has_role(auth.uid(), 'financial_manager')
  );

CREATE POLICY "Managers can update form conditions" ON public.form_conditions
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'general_manager') OR
    public.has_role(auth.uid(), 'support_manager') OR
    public.has_role(auth.uid(), 'cs_manager') OR
    public.has_role(auth.uid(), 'financial_manager')
  );

CREATE POLICY "Managers can delete form conditions" ON public.form_conditions
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'general_manager') OR
    public.has_role(auth.uid(), 'support_manager') OR
    public.has_role(auth.uid(), 'cs_manager') OR
    public.has_role(auth.uid(), 'financial_manager')
  );

-- =====================================================
-- TABELA: form_calculations
-- =====================================================

DROP POLICY IF EXISTS "Managers can create form calculations" ON public.form_calculations;
DROP POLICY IF EXISTS "Managers can update form calculations" ON public.form_calculations;
DROP POLICY IF EXISTS "Managers can delete form calculations" ON public.form_calculations;

CREATE POLICY "Managers can create form calculations" ON public.form_calculations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'general_manager') OR
    public.has_role(auth.uid(), 'support_manager') OR
    public.has_role(auth.uid(), 'cs_manager') OR
    public.has_role(auth.uid(), 'financial_manager')
  );

CREATE POLICY "Managers can update form calculations" ON public.form_calculations
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'general_manager') OR
    public.has_role(auth.uid(), 'support_manager') OR
    public.has_role(auth.uid(), 'cs_manager') OR
    public.has_role(auth.uid(), 'financial_manager')
  );

CREATE POLICY "Managers can delete form calculations" ON public.form_calculations
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'general_manager') OR
    public.has_role(auth.uid(), 'support_manager') OR
    public.has_role(auth.uid(), 'cs_manager') OR
    public.has_role(auth.uid(), 'financial_manager')
  );