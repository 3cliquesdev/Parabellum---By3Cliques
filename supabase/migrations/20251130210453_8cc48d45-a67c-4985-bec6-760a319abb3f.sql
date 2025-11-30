
-- Fix 1: Corrigir função audit_table_changes para tratar INSERT
CREATE OR REPLACE FUNCTION public.audit_table_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    -- ✅ ADICIONAR: Tratar operações INSERT
    RETURN NEW;
  END IF;
  
  -- ✅ FALLBACK: Se por algum motivo nenhum IF acima executar
  RETURN NULL;
END;
$$;

-- Fix 2: Remover trigger duplicado audit_tickets_trigger
DROP TRIGGER IF EXISTS audit_tickets_trigger ON public.tickets;

-- Comentário explicativo
COMMENT ON FUNCTION public.audit_table_changes() IS 
  'Audit function that logs DELETE and UPDATE operations. INSERT operations pass through without logging. Fixed 2F005 error by adding RETURN for all TG_OP cases.';
