-- MIGRATION 1: Adicionar financial_manager role ao ENUM
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financial_manager';

-- Adicionar Departamento Financeiro
INSERT INTO public.departments (name, description, color, is_active)
VALUES ('Financeiro', 'Gestão de reembolsos, trocas e pagamentos', '#F59E0B', true)
ON CONFLICT (name) DO NOTHING;