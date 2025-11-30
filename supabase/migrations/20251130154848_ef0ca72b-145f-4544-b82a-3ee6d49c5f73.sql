-- Remove a constraint que está impedindo a atualização
ALTER TABLE public.ai_personas DROP CONSTRAINT IF EXISTS ai_personas_role_check;