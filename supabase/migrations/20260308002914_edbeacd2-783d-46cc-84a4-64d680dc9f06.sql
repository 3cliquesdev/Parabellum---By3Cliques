DROP TRIGGER IF EXISTS update_business_messages_config_updated_at ON public.business_messages_config;

CREATE TRIGGER update_business_messages_config_updated_at
  BEFORE UPDATE ON public.business_messages_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();