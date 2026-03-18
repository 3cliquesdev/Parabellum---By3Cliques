DELETE FROM ai_response_cache
WHERE answer ILIKE '%Pode repetir%'
   OR answer ILIKE '%nao consegui processar corretamente%'
   OR answer ILIKE '%não consegui processar corretamente%';