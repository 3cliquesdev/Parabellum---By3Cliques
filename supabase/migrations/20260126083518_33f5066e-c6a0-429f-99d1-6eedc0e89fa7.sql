-- Criar bucket chat-media para armazenar arquivos de mídia
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media', 
  'chat-media', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'video/mp4', 'video/3gpp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir leitura pública
CREATE POLICY "Public read access for chat-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

-- Política para permitir upload via service role (edge functions)
CREATE POLICY "Service role upload for chat-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-media');

-- Política para permitir update via service role
CREATE POLICY "Service role update for chat-media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'chat-media');

-- Política para permitir delete via service role
CREATE POLICY "Service role delete for chat-media"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-media');