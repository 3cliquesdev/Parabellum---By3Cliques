-- Create saved_deal_filters table for storing user filter presets
CREATE TABLE public.saved_deal_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_deal_filters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - users can only manage their own saved filters
CREATE POLICY "Users can view own saved filters"
ON public.saved_deal_filters
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved filters"
ON public.saved_deal_filters
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved filters"
ON public.saved_deal_filters
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved filters"
ON public.saved_deal_filters
FOR DELETE
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_saved_deal_filters_updated_at
BEFORE UPDATE ON public.saved_deal_filters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();