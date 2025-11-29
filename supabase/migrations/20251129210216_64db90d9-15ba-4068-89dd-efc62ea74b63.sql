-- FASE FINAL: Corrigir última função sem search_path

-- Recriar função com search_path correto (usando CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.update_playbook_executions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;