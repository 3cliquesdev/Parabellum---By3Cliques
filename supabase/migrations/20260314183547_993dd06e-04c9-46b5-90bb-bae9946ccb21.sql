ALTER TABLE public.business_messages_config 
  ADD COLUMN IF NOT EXISTS after_hours_tag_id uuid REFERENCES public.tags(id) ON DELETE SET NULL;