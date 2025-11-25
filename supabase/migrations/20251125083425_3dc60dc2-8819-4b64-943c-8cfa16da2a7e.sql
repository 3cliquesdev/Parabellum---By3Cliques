-- Passo 1: Remover constraint existente
ALTER TABLE public.ai_routing_rules 
DROP CONSTRAINT IF EXISTS ai_routing_rules_channel_check;

-- Passo 2: Atualizar valores inválidos
UPDATE public.ai_routing_rules 
SET channel = 'web_chat' 
WHERE channel IN ('chat', 'form');

-- Passo 3: Adicionar novo constraint com valores corretos
ALTER TABLE public.ai_routing_rules
ADD CONSTRAINT ai_routing_rules_channel_check 
CHECK (channel IN ('web_chat', 'whatsapp', 'email'));