-- Migração para preencher lead_email em deals históricos usando dados do Kiwify
-- Apenas para deals com status 'won' que têm transação Kiwify vinculada mas sem lead_email

UPDATE public.deals d
SET lead_email = ke.customer_email
FROM public.kiwify_events ke
WHERE ke.linked_deal_id = d.id
  AND d.status = 'won'
  AND (d.lead_email IS NULL OR d.lead_email = '')
  AND ke.customer_email IS NOT NULL
  AND ke.customer_email != '';