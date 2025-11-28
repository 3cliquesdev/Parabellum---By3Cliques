-- ============================================
-- CORREÇÃO: Adicionar SET search_path às funções
-- ============================================

-- Recriar função com search_path explícito
CREATE OR REPLACE FUNCTION public.create_initial_cadence_task()
RETURNS TRIGGER AS $$
DECLARE
  v_first_step RECORD;
  v_scheduled_date DATE;
BEGIN
  -- Buscar o primeiro step da cadência (position = 1)
  SELECT * INTO v_first_step
  FROM cadence_steps
  WHERE cadence_id = NEW.cadence_id
  AND position = 1
  LIMIT 1;

  IF v_first_step.id IS NULL THEN
    RAISE EXCEPTION 'Cadência % não possui step inicial', NEW.cadence_id;
  END IF;

  -- Calcular data agendada baseada em day_offset
  v_scheduled_date := (NEW.started_at::DATE) + v_first_step.day_offset;

  -- Criar task para o primeiro step
  INSERT INTO cadence_tasks (
    enrollment_id,
    step_id,
    contact_id,
    assigned_to,
    task_type,
    title,
    description,
    template_content,
    scheduled_for,
    status
  )
  VALUES (
    NEW.id,
    v_first_step.id,
    NEW.contact_id,
    NEW.enrolled_by,
    v_first_step.step_type,
    COALESCE(v_first_step.task_title, 'Passo ' || v_first_step.position || ' - ' || v_first_step.step_type),
    v_first_step.task_description,
    v_first_step.message_template,
    v_scheduled_date,
    'pending'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar função com search_path explícito
CREATE OR REPLACE FUNCTION public.advance_cadence_step()
RETURNS TRIGGER AS $$
DECLARE
  v_enrollment RECORD;
  v_next_step RECORD;
  v_scheduled_date DATE;
  v_total_steps INT;
BEGIN
  -- Só processar quando status mudar para 'completed'
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Buscar enrollment
  SELECT * INTO v_enrollment
  FROM cadence_enrollments
  WHERE id = NEW.enrollment_id;

  IF v_enrollment.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Contar total de steps na cadência
  SELECT COUNT(*) INTO v_total_steps
  FROM cadence_steps
  WHERE cadence_id = v_enrollment.cadence_id;

  -- Verificar se já é o último step
  IF v_enrollment.current_step >= v_total_steps THEN
    -- Finalizar enrollment
    UPDATE cadence_enrollments
    SET 
      status = 'completed',
      completed_at = NOW()
    WHERE id = v_enrollment.id;
    
    RETURN NEW;
  END IF;

  -- Buscar próximo step
  SELECT * INTO v_next_step
  FROM cadence_steps
  WHERE cadence_id = v_enrollment.cadence_id
  AND position = (v_enrollment.current_step + 1)
  LIMIT 1;

  IF v_next_step.id IS NULL THEN
    -- Não há próximo step, finalizar
    UPDATE cadence_enrollments
    SET 
      status = 'completed',
      completed_at = NOW()
    WHERE id = v_enrollment.id;
    
    RETURN NEW;
  END IF;

  -- Calcular data agendada para próximo step
  v_scheduled_date := CURRENT_DATE + v_next_step.day_offset;

  -- Atualizar enrollment para próximo step
  UPDATE cadence_enrollments
  SET 
    current_step = v_enrollment.current_step + 1,
    next_step_at = v_scheduled_date
  WHERE id = v_enrollment.id;

  -- Criar task para próximo step
  INSERT INTO cadence_tasks (
    enrollment_id,
    step_id,
    contact_id,
    assigned_to,
    task_type,
    title,
    description,
    template_content,
    scheduled_for,
    status
  )
  VALUES (
    v_enrollment.id,
    v_next_step.id,
    v_enrollment.contact_id,
    v_enrollment.enrolled_by,
    v_next_step.step_type,
    COALESCE(v_next_step.task_title, 'Passo ' || v_next_step.position || ' - ' || v_next_step.step_type),
    v_next_step.task_description,
    v_next_step.message_template,
    v_scheduled_date,
    'pending'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar função com search_path explícito
CREATE OR REPLACE FUNCTION public.pause_cadence_on_reply()
RETURNS TRIGGER AS $$
DECLARE
  v_enrollment RECORD;
BEGIN
  -- Só processar mensagens de customers
  IF NEW.sender_type != 'customer' THEN
    RETURN NEW;
  END IF;

  -- Buscar enrollment ativo para este contato
  SELECT ce.* INTO v_enrollment
  FROM cadence_enrollments ce
  WHERE ce.contact_id = (
    SELECT contact_id FROM conversations WHERE id = NEW.conversation_id
  )
  AND ce.status = 'active'
  LIMIT 1;

  IF v_enrollment.id IS NOT NULL THEN
    -- Pausar enrollment
    UPDATE cadence_enrollments
    SET 
      status = 'paused',
      replied_at = NEW.created_at
    WHERE id = v_enrollment.id;

    -- Cancelar tasks pendentes
    UPDATE cadence_tasks
    SET status = 'skipped'
    WHERE enrollment_id = v_enrollment.id
    AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;