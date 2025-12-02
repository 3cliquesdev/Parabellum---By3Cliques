-- Create conversation_tags junction table
CREATE TABLE public.conversation_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(conversation_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "authenticated_can_view_conversation_tags"
ON public.conversation_tags FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_manager_can_manage_conversation_tags"
ON public.conversation_tags FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "support_agent_can_manage_conversation_tags"
ON public.conversation_tags FOR ALL
USING (has_role(auth.uid(), 'support_agent'::app_role))
WITH CHECK (has_role(auth.uid(), 'support_agent'::app_role));

CREATE POLICY "sales_rep_can_manage_conversation_tags"
ON public.conversation_tags FOR ALL
USING (has_role(auth.uid(), 'sales_rep'::app_role))
WITH CHECK (has_role(auth.uid(), 'sales_rep'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_tags;