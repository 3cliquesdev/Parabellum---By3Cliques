-- Limpar conversa bugada com mensagens em loop infinito
-- Manter apenas as primeiras 20 mensagens da conversa problemática

DELETE FROM messages 
WHERE conversation_id = '637978d7-1211-4180-8886-0faca26b6b43'
AND id NOT IN (
  SELECT id FROM messages 
  WHERE conversation_id = '637978d7-1211-4180-8886-0faca26b6b43'
  ORDER BY created_at 
  LIMIT 20
);