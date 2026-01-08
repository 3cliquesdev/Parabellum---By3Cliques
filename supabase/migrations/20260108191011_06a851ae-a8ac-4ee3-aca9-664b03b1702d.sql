-- Add is_system column to project_card_comments for system-generated comments
ALTER TABLE public.project_card_comments 
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- Create function to notify on card column change
CREATE OR REPLACE FUNCTION public.notify_project_card_column_change()
RETURNS TRIGGER AS $$
DECLARE
  new_column_notify BOOLEAN;
BEGIN
  -- Only trigger if column_id actually changed
  IF OLD.column_id IS DISTINCT FROM NEW.column_id THEN
    -- Check if new column has notification enabled
    SELECT notify_client_on_enter INTO new_column_notify
    FROM project_columns
    WHERE id = NEW.column_id;
    
    -- Only call edge function if notification is enabled
    IF new_column_notify THEN
      PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/notify-project-card-moved',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
        ),
        body := jsonb_build_object(
          'card_id', NEW.id,
          'old_column_id', OLD.column_id,
          'new_column_id', NEW.column_id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for card updates
DROP TRIGGER IF EXISTS trigger_notify_card_column_change ON project_cards;
CREATE TRIGGER trigger_notify_card_column_change
  AFTER UPDATE ON project_cards
  FOR EACH ROW
  EXECUTE FUNCTION notify_project_card_column_change();

-- Add email_template_id to project_columns if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'project_columns' 
    AND column_name = 'email_template_id'
  ) THEN
    ALTER TABLE public.project_columns 
    ADD COLUMN email_template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL;
  END IF;
END $$;