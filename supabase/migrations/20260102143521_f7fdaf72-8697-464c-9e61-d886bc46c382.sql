-- Criar função para invocar automações quando deals são criados
CREATE OR REPLACE FUNCTION public.trigger_deal_automations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Apenas executar para novos deals sem assigned_to
  IF NEW.assigned_to IS NULL THEN
    -- Usar pg_net para chamar a edge function de forma assíncrona
    PERFORM net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/execute-automations',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
      ),
      body := jsonb_build_object(
        'trigger_event', 'deal_created',
        'data', jsonb_build_object(
          'deal_id', NEW.id,
          'pipeline_id', NEW.pipeline_id,
          'value', COALESCE(NEW.value, 0),
          'title', NEW.title,
          'contact_id', NEW.contact_id
        )
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para novos deals
DROP TRIGGER IF EXISTS on_deal_created_trigger ON public.deals;

CREATE TRIGGER on_deal_created_trigger
  AFTER INSERT ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_deal_automations();

-- Atualizar a automação existente para usar o UUID correto do departamento Comercial
UPDATE public.automations
SET action_config = jsonb_set(
  action_config,
  '{department}',
  '"f446e202-bdc3-4bb3-aeda-8c0aa04ee53c"'
)
WHERE name = 'Auto-assign Leads Round Robin'
AND action_config->>'department' = 'comercial';