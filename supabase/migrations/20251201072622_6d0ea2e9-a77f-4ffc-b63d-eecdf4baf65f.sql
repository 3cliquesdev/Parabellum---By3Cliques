-- Corrigir dados existentes: Mesclar deals duplicados do IBUYBRASIL
-- e preparar sistema para one-deal-per-customer em recuperação

-- 1. Identificar e mesclar deals duplicados do cliente IBUYBRASIL
DO $$
DECLARE
  v_contact_id UUID;
  v_oldest_deal_id UUID;
  v_total_value NUMERIC;
  v_all_products TEXT;
BEGIN
  -- Buscar contact_id do IBUYBRASIL
  SELECT id INTO v_contact_id
  FROM contacts
  WHERE email = 'ibuybrasil@gmail.com';
  
  IF v_contact_id IS NOT NULL THEN
    -- Buscar deal mais antigo (principal)
    SELECT id INTO v_oldest_deal_id
    FROM deals
    WHERE contact_id = v_contact_id
      AND status = 'open'
      AND title ILIKE '%Recuperação%'
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF v_oldest_deal_id IS NOT NULL THEN
      -- Calcular valor total somando todos os deals
      SELECT SUM(value) INTO v_total_value
      FROM deals
      WHERE contact_id = v_contact_id
        AND status = 'open'
        AND title ILIKE '%Recuperação%';
      
      -- Montar título com todos os produtos
      SELECT string_agg(
        CASE 
          WHEN title ILIKE '%Plano Mensal%' THEN 'Plano Mensal'
          WHEN title ILIKE '%Curso%' OR title ILIKE '%Uni3Cliques%' THEN 'Curso: Uni3Cliques'
          ELSE regexp_replace(title, 'Recuperação - |IBUYBRASIL', '', 'g')
        END,
        ' + '
      ) INTO v_all_products
      FROM deals
      WHERE contact_id = v_contact_id
        AND status = 'open'
        AND title ILIKE '%Recuperação%';
      
      -- Atualizar deal principal com valor somado e todos os produtos
      UPDATE deals
      SET 
        value = v_total_value,
        title = 'Recuperação - ' || v_all_products || ' - IBUYBRASIL',
        updated_at = NOW()
      WHERE id = v_oldest_deal_id;
      
      -- Registrar mesclagem na timeline
      INSERT INTO interactions (
        customer_id,
        type,
        channel,
        content,
        metadata
      ) VALUES (
        v_contact_id,
        'note',
        'other',
        '🔀 Deals duplicados mesclados automaticamente. Valor total: R$ ' || v_total_value::TEXT,
        jsonb_build_object(
          'merged_at', NOW(),
          'total_value', v_total_value,
          'products', v_all_products,
          'kept_deal_id', v_oldest_deal_id
        )
      );
      
      -- Deletar deals duplicados (mantém apenas o mais antigo)
      DELETE FROM deals
      WHERE contact_id = v_contact_id
        AND status = 'open'
        AND title ILIKE '%Recuperação%'
        AND id != v_oldest_deal_id;
      
      RAISE NOTICE 'Deals mesclados para IBUYBRASIL. Deal principal: %, Valor total: R$ %', v_oldest_deal_id, v_total_value;
    END IF;
  END IF;
END $$;