ALTER TABLE public.conversations ADD COLUMN deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL;
CREATE INDEX idx_conversations_deal_id ON public.conversations(deal_id);