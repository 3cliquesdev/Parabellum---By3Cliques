-- Adicionar audio/webm ao bucket chat-attachments
UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'audio/webm')
WHERE id = 'chat-attachments'
  AND NOT ('audio/webm' = ANY(allowed_mime_types));

-- Adicionar audio/webm ao bucket chat-media também
UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'audio/webm')
WHERE id = 'chat-media'
  AND NOT ('audio/webm' = ANY(allowed_mime_types));