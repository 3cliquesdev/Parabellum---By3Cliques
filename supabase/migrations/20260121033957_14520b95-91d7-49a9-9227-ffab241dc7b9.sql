-- Adicionar coluna kiwify_offer_id na tabela deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS kiwify_offer_id TEXT;

-- Criar índice para performance nas buscas
CREATE INDEX IF NOT EXISTS idx_deals_kiwify_offer_id ON public.deals(kiwify_offer_id);

-- Backfill: extrair offer_id dos eventos Kiwify relacionados
UPDATE public.deals d
SET kiwify_offer_id = (
  SELECT COALESCE(
    k.payload->'Subscription'->'plan'->>'id',
    k.payload->'Product'->>'product_offer_id',
    k.offer_id
  )
  FROM public.kiwify_events k 
  WHERE k.id::text = d.pending_kiwify_event_id::text
  LIMIT 1
)
WHERE d.pending_kiwify_event_id IS NOT NULL 
  AND d.kiwify_offer_id IS NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.deals.kiwify_offer_id IS 'ID da oferta Kiwify para cruzamento com product_offers.source_type';