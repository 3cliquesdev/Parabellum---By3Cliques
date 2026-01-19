-- =====================================================
-- CORREÇÃO DE CLASSIFICAÇÃO: kiwify_direto vs kiwify_recorrencia
-- Baseado em Subscription.charges.completed > 1 = renovação
-- =====================================================

-- 1. Atualizar deals existentes com classificação corrigida
WITH corrected_classification AS (
  SELECT 
    ke.linked_deal_id,
    CASE 
      WHEN jsonb_array_length(COALESCE(ke.payload->'Subscription'->'charges'->'completed', '[]'::jsonb)) > 1 
        THEN 'kiwify_recorrencia'
      ELSE 'kiwify_direto'
    END AS correct_lead_source
  FROM kiwify_events ke
  WHERE ke.linked_deal_id IS NOT NULL
    AND ke.event_type IN ('paid', 'order_approved')
)
UPDATE deals d
SET lead_source = cc.correct_lead_source
FROM corrected_classification cc
WHERE d.id = cc.linked_deal_id
  AND d.lead_source IN ('kiwify_direto', 'kiwify_recorrencia')
  AND d.lead_source != cc.correct_lead_source;

-- 2. Criar deals faltantes para eventos sem linked_deal_id do dia 15/01/2026
DO $$
DECLARE
  v_default_pipeline_id UUID;
  v_recurrence_pipeline_id UUID;
  v_default_won_stage_id UUID;
  v_recurrence_won_stage_id UUID;
  v_event RECORD;
  v_contact_id UUID;
  v_new_deal_id UUID;
  v_is_renewal BOOLEAN;
  v_lead_source TEXT;
  v_pipeline_id UUID;
  v_stage_id UUID;
  v_gross_value NUMERIC;
  v_net_value NUMERIC;
  v_customer_email TEXT;
  v_product_name TEXT;
  v_approved_timestamp TIMESTAMPTZ;
BEGIN
  -- Buscar Pipeline Nacional (padrão)
  SELECT id INTO v_default_pipeline_id 
  FROM pipelines 
  WHERE is_default = true 
  LIMIT 1;

  -- Buscar Pipeline de Recorrência
  SELECT id INTO v_recurrence_pipeline_id 
  FROM pipelines 
  WHERE name = 'Pipeline de Recorrência' 
  LIMIT 1;

  -- Buscar stage Ganho do pipeline padrão
  SELECT id INTO v_default_won_stage_id 
  FROM stages 
  WHERE pipeline_id = v_default_pipeline_id 
  ORDER BY position DESC 
  LIMIT 1;

  -- Buscar stage Ganho do pipeline de recorrência
  IF v_recurrence_pipeline_id IS NOT NULL THEN
    SELECT id INTO v_recurrence_won_stage_id 
    FROM stages 
    WHERE pipeline_id = v_recurrence_pipeline_id 
      AND name = 'Ganho'
    LIMIT 1;
  END IF;

  -- Processar eventos sem linked_deal_id do dia 15/01/2026
  FOR v_event IN 
    SELECT 
      ke.id AS event_id,
      ke.order_id,
      ke.payload,
      ke.customer_email,
      ke.event_type,
      ke.created_at AS event_created_at,
      (ke.payload->'Commissions'->>'product_base_price')::NUMERIC AS gross_cents,
      (ke.payload->'Commissions'->>'my_commission')::NUMERIC AS net_cents,
      ke.payload->'Product'->>'product_name' AS product_name,
      COALESCE(jsonb_array_length(ke.payload->'Subscription'->'charges'->'completed'), 0) AS charges_count
    FROM kiwify_events ke
    WHERE ke.linked_deal_id IS NULL
      AND ke.event_type IN ('paid', 'order_approved')
      AND ke.payload->>'approved_date' LIKE '2026-01-15%'
  LOOP
    -- Determinar se é renovação (mais de 1 cobrança)
    v_is_renewal := v_event.charges_count > 1;
    
    -- Definir lead_source e pipeline
    IF v_is_renewal THEN
      v_lead_source := 'kiwify_recorrencia';
      v_pipeline_id := v_recurrence_pipeline_id;
      v_stage_id := v_recurrence_won_stage_id;
    ELSE
      v_lead_source := 'kiwify_direto';
      v_pipeline_id := v_default_pipeline_id;
      v_stage_id := v_default_won_stage_id;
    END IF;

    -- Se pipeline de recorrência não existe, usar padrão
    IF v_pipeline_id IS NULL THEN
      v_pipeline_id := v_default_pipeline_id;
      v_stage_id := v_default_won_stage_id;
    END IF;

    -- Calcular valores
    v_gross_value := COALESCE(v_event.gross_cents, 0) / 100;
    v_net_value := COALESCE(v_event.net_cents, v_event.gross_cents, 0) / 100;
    v_customer_email := v_event.customer_email;
    v_product_name := COALESCE(v_event.product_name, 'Produto Kiwify');
    v_approved_timestamp := v_event.event_created_at; -- Usar created_at do evento como fallback

    -- Buscar contato pelo email
    SELECT id INTO v_contact_id 
    FROM contacts 
    WHERE email = v_customer_email 
    LIMIT 1;

    -- Se não encontrou contato, criar um básico
    IF v_contact_id IS NULL AND v_customer_email IS NOT NULL THEN
      INSERT INTO contacts (
        email, 
        first_name, 
        last_name, 
        status, 
        total_ltv,
        last_kiwify_event,
        last_kiwify_event_at
      ) VALUES (
        v_customer_email,
        COALESCE(v_event.payload->'Customer'->>'full_name', 'Cliente'),
        'Kiwify',
        'customer',
        v_net_value,
        'paid',
        NOW()
      )
      RETURNING id INTO v_contact_id;
    END IF;

    -- Criar deal se temos contato
    IF v_contact_id IS NOT NULL THEN
      INSERT INTO deals (
        title,
        contact_id,
        pipeline_id,
        stage_id,
        status,
        value,
        gross_value,
        net_value,
        is_organic_sale,
        is_returning_customer,
        lead_source,
        closed_at,
        created_at,
        updated_at
      ) VALUES (
        CASE WHEN v_is_renewal 
          THEN 'Recorrência - ' || v_product_name 
          ELSE 'Venda Orgânica - ' || v_product_name 
        END,
        v_contact_id,
        v_pipeline_id,
        v_stage_id,
        'won',
        v_net_value,
        v_gross_value,
        v_net_value,
        true,
        v_is_renewal,
        v_lead_source,
        v_approved_timestamp,
        v_approved_timestamp,
        NOW()
      )
      RETURNING id INTO v_new_deal_id;

      -- Vincular evento ao deal
      UPDATE kiwify_events 
      SET linked_deal_id = v_new_deal_id 
      WHERE id = v_event.event_id;
    END IF;
  END LOOP;
END $$;