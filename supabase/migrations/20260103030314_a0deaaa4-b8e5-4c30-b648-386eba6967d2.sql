-- Criar bucket público para anexos de formulário
INSERT INTO storage.buckets (id, name, public)
VALUES ('form-attachments', 'form-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para o bucket
CREATE POLICY "Public can upload to form-attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'form-attachments');

CREATE POLICY "Public can read form-attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'form-attachments');