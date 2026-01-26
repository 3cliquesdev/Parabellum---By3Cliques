-- Atualizar RPC para lidar com emails duplicados
-- Se o email já existe em outro contato, apenas marca como cliente e move para suporte (sem atualizar email)

CREATE OR REPLACE FUNCTION fix_leads_that_are_kiwify_customers()
RETURNS TABLE(
  contacts_updated integer,
  conversations_updated integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contacts_updated integer := 0;
  v_conversations_updated integer := 0;
  v_suporte_dept_id uuid := '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
BEGIN
  -- 1. Criar tabela temporária com leads que têm telefone na Kiwify
  CREATE TEMP TABLE leads_to_fix AS
  WITH kiwify_data AS (
    SELECT DISTINCT ON (RIGHT(REGEXP_REPLACE(payload->'Customer'->>'mobile', '[^0-9]', '', 'g'), 9))
      RIGHT(REGEXP_REPLACE(payload->'Customer'->>'mobile', '[^0-9]', '', 'g'), 9) as last9,
      payload->'Customer'->>'email' as kiwify_email
    FROM kiwify_events 
    WHERE event_type IN ('paid', 'order_approved', 'subscription_renewed')
      AND payload->'Customer'->>'mobile' IS NOT NULL
    ORDER BY RIGHT(REGEXP_REPLACE(payload->'Customer'->>'mobile', '[^0-9]', '', 'g'), 9), created_at DESC
  )
  SELECT 
    ct.id as contact_id,
    kd.kiwify_email,
    -- Verificar se email já existe em outro contato
    EXISTS (
      SELECT 1 FROM contacts c2 
      WHERE c2.email = kd.kiwify_email 
      AND c2.id != ct.id
    ) as email_already_exists
  FROM contacts ct
  JOIN conversations c ON c.contact_id = ct.id
  JOIN kiwify_data kd ON 
    RIGHT(REGEXP_REPLACE(ct.phone, '[^0-9]', '', 'g'), 9) = kd.last9
  WHERE ct.status = 'lead'
    AND ct.email IS NULL
    AND c.status = 'open';

  -- 2. Atualizar contatos onde email NÃO existe em outro contato (pode atualizar email)
  UPDATE contacts ct
  SET 
    status = 'customer',
    email = ltf.kiwify_email,
    kiwify_validated = true,
    kiwify_validated_at = now(),
    source = 'kiwify_batch_fix'
  FROM leads_to_fix ltf
  WHERE ct.id = ltf.contact_id
    AND ltf.email_already_exists = false;

  -- 3. Atualizar contatos onde email JÁ existe (apenas marca como cliente, sem atualizar email)
  UPDATE contacts ct
  SET 
    status = 'customer',
    kiwify_validated = true,
    kiwify_validated_at = now(),
    source = 'kiwify_batch_fix_dup'
  FROM leads_to_fix ltf
  WHERE ct.id = ltf.contact_id
    AND ltf.email_already_exists = true;
  
  -- Contar total de atualizados
  SELECT COUNT(*) INTO v_contacts_updated FROM leads_to_fix;

  -- 4. Atualizar conversas abertas desses contatos para Suporte
  UPDATE conversations c
  SET department = v_suporte_dept_id
  FROM leads_to_fix ltf
  WHERE c.contact_id = ltf.contact_id
    AND c.status = 'open'
    AND (c.department IS NULL OR c.department != v_suporte_dept_id);
  
  GET DIAGNOSTICS v_conversations_updated = ROW_COUNT;

  -- 5. Limpar tabela temporária
  DROP TABLE IF EXISTS leads_to_fix;

  -- 6. Retornar resultado
  RETURN QUERY SELECT v_contacts_updated, v_conversations_updated;
END;
$$;