-- Adicionar controle de Priority Instructions nas personas
ALTER TABLE public.ai_personas
ADD COLUMN IF NOT EXISTS use_priority_instructions boolean DEFAULT false;

COMMENT ON COLUMN public.ai_personas.use_priority_instructions IS 'Quando true, usa instruções prioritárias personalizadas (boas-vindas, OTP). Quando false, usa comportamento genérico da IA.';