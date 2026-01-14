-- Função para batch update de validação Kiwify
-- Atualiza todos os contatos cujo telefone (últimos 9 dígitos) 
-- bate com algum mobile de compra Kiwify

CREATE OR REPLACE FUNCTION batch_validate_kiwify_contacts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  -- Atualiza contatos cujo telefone (últimos 9 dígitos) 
  -- bate com algum mobile de compra Kiwify paga
  WITH kiwify_phones AS (
    SELECT DISTINCT 
      RIGHT(REGEXP_REPLACE(payload->'Customer'->>'mobile', '[^0-9]', '', 'g'), 9) as last9
    FROM kiwify_events 
    WHERE event_type IN ('paid', 'order_approved', 'subscription_renewed')
      AND payload->'Customer'->>'mobile' IS NOT NULL
      AND LENGTH(REGEXP_REPLACE(payload->'Customer'->>'mobile', '[^0-9]', '', 'g')) >= 9
  )
  UPDATE contacts c
  SET 
    kiwify_validated = true,
    kiwify_validated_at = now()
  FROM kiwify_phones kp
  WHERE RIGHT(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'), 9) = kp.last9
    AND LENGTH(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g')) >= 9
    AND (c.kiwify_validated IS NULL OR c.kiwify_validated = false);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$$;