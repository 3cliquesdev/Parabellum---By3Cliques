-- Create ticket_tags table following the existing pattern
CREATE TABLE public.ticket_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(ticket_id, tag_id)
);

-- Enable Row Level Security
ALTER TABLE public.ticket_tags ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to manage ticket tags
CREATE POLICY "Authenticated users can manage ticket tags" 
ON public.ticket_tags 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Create indices for better performance
CREATE INDEX idx_ticket_tags_ticket_id ON public.ticket_tags(ticket_id);
CREATE INDEX idx_ticket_tags_tag_id ON public.ticket_tags(tag_id);