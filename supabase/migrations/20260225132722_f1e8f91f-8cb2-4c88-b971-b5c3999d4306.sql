
-- Create ticket-attachments bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read (public bucket)
CREATE POLICY "Public read ticket-attachments" ON storage.objects
FOR SELECT USING (bucket_id = 'ticket-attachments');

-- Allow service role to insert (edge function will use service role)
CREATE POLICY "Service role insert ticket-attachments" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'ticket-attachments');
