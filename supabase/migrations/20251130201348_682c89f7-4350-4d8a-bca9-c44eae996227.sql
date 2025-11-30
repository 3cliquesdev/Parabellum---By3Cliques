-- FASE 3: Limpar cache de respostas de fallback existentes
DELETE FROM ai_response_cache 
WHERE answer ILIKE '%vou chamar um especialista%'
   OR answer ILIKE '%transferir para um atendente%'
   OR answer ILIKE '%não consegui registrar%'
   OR answer ILIKE '%não tenho essa informação%';