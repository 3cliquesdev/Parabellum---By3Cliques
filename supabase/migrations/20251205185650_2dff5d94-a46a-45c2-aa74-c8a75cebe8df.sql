-- 1. Adicionar coluna linked_deal_id na tabela kiwify_events
ALTER TABLE public.kiwify_events 
ADD COLUMN IF NOT EXISTS linked_deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL;

-- 2. Criar índice para busca por order_ref (payload JSON)
CREATE INDEX IF NOT EXISTS idx_kiwify_events_order_ref 
ON public.kiwify_events ((payload->>'order_ref'));

-- 3. Criar índice para linked_deal_id
CREATE INDEX IF NOT EXISTS idx_kiwify_events_linked_deal 
ON public.kiwify_events(linked_deal_id);

-- 4. Criar índice para eventos pagos não vinculados (performance)
CREATE INDEX IF NOT EXISTS idx_kiwify_events_paid_unlinked 
ON public.kiwify_events(event_type, linked_deal_id) 
WHERE event_type IN ('paid', 'order_approved') AND linked_deal_id IS NULL;