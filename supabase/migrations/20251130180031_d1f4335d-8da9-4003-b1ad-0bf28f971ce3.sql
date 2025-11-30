-- FASE 5: Habilitar Realtime para a tabela messages
-- Usar bloco DO para evitar erro se já existir
DO $$
BEGIN
  -- Tentar adicionar a tabela à publicação
  -- Se já existir, o comando falha mas o bloco captura o erro
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
  WHEN duplicate_object THEN
    -- Já existe, não fazer nada
    NULL;
END $$;