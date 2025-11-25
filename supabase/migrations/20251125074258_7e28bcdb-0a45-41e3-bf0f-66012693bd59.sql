-- FASE 2: Menu Híbrido com WhatsApp

-- 2.1 Adicionar campo whatsapp_number à tabela departments
ALTER TABLE public.departments 
ADD COLUMN whatsapp_number TEXT;

COMMENT ON COLUMN public.departments.whatsapp_number IS 
'Número WhatsApp com DDI (ex: 5511999999999) - formato: apenas números, 12-13 dígitos';