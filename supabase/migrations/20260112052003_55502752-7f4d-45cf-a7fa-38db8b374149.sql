-- =====================================================
-- TRIGGER GUARDRAIL: Impedir atribuição a não-sales_rep
-- =====================================================

-- Função que sanitiza assigned_to antes de INSERT/UPDATE
CREATE OR REPLACE FUNCTION sanitize_deal_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_has_sales_rep_role BOOLEAN := FALSE;
  v_is_in_pipeline_team BOOLEAN := FALSE;
  v_pipeline_has_team BOOLEAN := FALSE;
BEGIN
  -- Se assigned_to é NULL, não precisa validar
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verificar se o usuário tem role sales_rep
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.assigned_to 
      AND role = 'sales_rep'
  ) INTO v_has_sales_rep_role;

  -- Se não é sales_rep, limpar atribuição
  IF NOT v_has_sales_rep_role THEN
    RAISE NOTICE 'Deal assignment blocked: user % is not a sales_rep', NEW.assigned_to;
    NEW.assigned_to := NULL;
    RETURN NEW;
  END IF;

  -- Verificar se o pipeline tem equipe configurada
  SELECT EXISTS (
    SELECT 1 FROM pipeline_sales_reps 
    WHERE pipeline_id = NEW.pipeline_id
  ) INTO v_pipeline_has_team;

  -- Se pipeline tem equipe, verificar se o usuário pertence a ela
  IF v_pipeline_has_team THEN
    SELECT EXISTS (
      SELECT 1 FROM pipeline_sales_reps 
      WHERE pipeline_id = NEW.pipeline_id 
        AND user_id = NEW.assigned_to
    ) INTO v_is_in_pipeline_team;

    IF NOT v_is_in_pipeline_team THEN
      RAISE NOTICE 'Deal assignment blocked: user % is not in pipeline % team', NEW.assigned_to, NEW.pipeline_id;
      NEW.assigned_to := NULL;
      RETURN NEW;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remover trigger se existir
DROP TRIGGER IF EXISTS trigger_sanitize_deal_assignment ON deals;

-- Criar trigger BEFORE INSERT OR UPDATE
CREATE TRIGGER trigger_sanitize_deal_assignment
  BEFORE INSERT OR UPDATE OF assigned_to ON deals
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_deal_assignment();

-- =====================================================
-- ATUALIZAR TRIGGER DE AUTO-ATRIBUIÇÃO
-- =====================================================

CREATE OR REPLACE FUNCTION auto_assign_deal_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_assigned_user_id UUID;
BEGIN
  -- Só auto-atribuir se assigned_to estiver NULL e deal estiver open
  IF NEW.assigned_to IS NULL AND NEW.status = 'open' THEN
    -- Usar a função que respeita pipeline
    SELECT get_least_loaded_sales_rep_for_pipeline(NEW.pipeline_id) INTO v_assigned_user_id;
    
    IF v_assigned_user_id IS NOT NULL THEN
      NEW.assigned_to := v_assigned_user_id;
      RAISE NOTICE 'Deal auto-assigned to % via pipeline-aware round robin', v_assigned_user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- LIMPEZA: Desatribuir negócios do Pipeline Nacional
-- =====================================================

-- Desatribuir deals de usuários que não são sales_rep OU não estão na equipe do pipeline
UPDATE deals 
SET assigned_to = NULL, updated_at = NOW()
WHERE pipeline_id = 'a272c23a-bcd8-411c-bbc1-706c2aa95055'
  AND status = 'open'
  AND assigned_to IS NOT NULL
  AND (
    -- Usuário não é sales_rep
    assigned_to NOT IN (
      SELECT user_id FROM user_roles WHERE role = 'sales_rep'
    )
    OR
    -- Usuário não está na equipe do pipeline (se pipeline tem equipe)
    (
      EXISTS (SELECT 1 FROM pipeline_sales_reps WHERE pipeline_id = 'a272c23a-bcd8-411c-bbc1-706c2aa95055')
      AND assigned_to NOT IN (
        SELECT user_id FROM pipeline_sales_reps 
        WHERE pipeline_id = 'a272c23a-bcd8-411c-bbc1-706c2aa95055'
      )
    )
  );