
-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create trigger function to auto-generate embeddings via edge function
CREATE OR REPLACE FUNCTION public.trigger_generate_embedding()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_published = true AND (
    OLD IS NULL OR 
    OLD.content IS DISTINCT FROM NEW.content OR 
    OLD.is_published IS DISTINCT FROM NEW.is_published
  ) THEN
    PERFORM net.http_post(
      url := 'https://zaeozfdjhrmblfaxsyuu.supabase.co/functions/v1/generate-article-embedding',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW96ZmRqaHJtYmxmYXhzeXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NzcxODIsImV4cCI6MjA3OTQ1MzE4Mn0.lowOKwfcgxuGQPcWPEEw6TeCfXMR9h9EQRLAAs4mmZ0"}'::jsonb,
      body := json_build_object('article_id', NEW.id, 'content', NEW.content)::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on knowledge_articles table
DROP TRIGGER IF EXISTS on_article_publish ON public.knowledge_articles;
CREATE TRIGGER on_article_publish
  AFTER INSERT OR UPDATE ON public.knowledge_articles
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_embedding();
