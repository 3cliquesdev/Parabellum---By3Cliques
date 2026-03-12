
DROP FUNCTION IF EXISTS public.batch_validate_kiwify_contacts();

CREATE OR REPLACE FUNCTION public.batch_validate_kiwify_contacts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_rec record;
  v_products text;
BEGIN
  FOR v_rec IN
    SELECT DISTINCT ON (c.id) 
      c.id as contact_id,
      c.first_name,
      c.last_name,
      c.email as contact_email,
      COALESCE(c.phone, c.whatsapp_id) as contact_phone,
      ke.payload->'Customer'->>'email' as kiwify_email,
      ke.payload->'Product'->>'product_name' as product_name
    FROM contacts c
    JOIN kiwify_events ke 
      ON ke.event_type IN ('paid','order_approved','subscription_renewed')
      AND ke.payload->'Customer'->>'mobile' IS NOT NULL
      AND RIGHT(regexp_replace(COALESCE(c.phone, c.whatsapp_id, ''), '\D', '', 'g'), 9) 
        = RIGHT(regexp_replace(ke.payload->'Customer'->>'mobile', '\D', '', 'g'), 9)
    WHERE (c.kiwify_validated IS NOT TRUE)
      AND LENGTH(regexp_replace(COALESCE(c.phone, c.whatsapp_id, ''), '\D', '', 'g')) BETWEEN 10 AND 13
  LOOP
    SELECT string_agg(DISTINCT ke2.payload->'Product'->>'product_name', ', ')
    INTO v_products
    FROM kiwify_events ke2
    WHERE ke2.event_type IN ('paid','order_approved','subscription_renewed')
      AND RIGHT(regexp_replace(ke2.payload->'Customer'->>'mobile', '\D', '', 'g'), 9)
        = RIGHT(regexp_replace(v_rec.contact_phone, '\D', '', 'g'), 9);

    UPDATE contacts SET
      status = 'customer',
      source = 'kiwify_validated',
      kiwify_validated = true,
      kiwify_validated_at = now(),
      email = COALESCE(NULLIF(email, ''), v_rec.kiwify_email)
    WHERE id = v_rec.contact_id;

    INSERT INTO interactions (customer_id, type, content, channel)
    VALUES (
      v_rec.contact_id,
      'internal_note',
      format('✅ Cliente identificado via batch-validate Kiwify. Produtos: %s', COALESCE(v_products, v_rec.product_name)),
      'other'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('validated', v_count);
END;
$$
