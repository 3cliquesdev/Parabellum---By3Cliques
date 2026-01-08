-- Fix SECURITY DEFINER RLS bypass in upsert_contact_with_interaction
-- Adiciona validação de ownership para updates de contatos existentes

CREATE OR REPLACE FUNCTION public.upsert_contact_with_interaction(
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'form',
  p_assigned_to UUID DEFAULT NULL
)
RETURNS TABLE(
  contact_id UUID,
  is_new_contact BOOLEAN,
  previous_status customer_status,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id UUID;
  v_existing_contact RECORD;
  v_is_new BOOLEAN;
  v_interaction_content TEXT;
  v_caller_uid UUID := auth.uid();
  v_is_privileged BOOLEAN := FALSE;
BEGIN
  -- Validação básica de email
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email é obrigatório para upsert';
  END IF;

  -- Verificar se o caller tem roles privilegiadas (admin, manager, support)
  -- Isso permite que edge functions com service_role ou usuários privilegiados operem
  IF v_caller_uid IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = v_caller_uid 
      AND role IN ('admin', 'general_manager', 'cs_manager', 'sales_manager', 'support_manager', 'financial_manager', 'support')
    ) INTO v_is_privileged;
  ELSE
    -- Se não há auth.uid(), assumimos que é uma chamada via service_role (edge function)
    -- que já passou por validação no endpoint
    v_is_privileged := TRUE;
  END IF;

  -- Verificar se o contato já existe
  SELECT id, status, first_name, last_name, last_contact_date, assigned_to
  INTO v_existing_contact
  FROM public.contacts
  WHERE email = p_email;

  -- CASO 1: Contato NÃO existe - CRIAR NOVO
  IF v_existing_contact IS NULL THEN
    INSERT INTO public.contacts (
      email, 
      first_name, 
      last_name, 
      phone, 
      company,
      organization_id,
      assigned_to,
      status,
      last_contact_date
    )
    VALUES (
      p_email,
      p_first_name,
      p_last_name,
      p_phone,
      p_company,
      p_organization_id,
      p_assigned_to,
      'lead',
      NOW()
    )
    RETURNING id INTO v_contact_id;

    v_is_new := TRUE;
    v_interaction_content := format(
      'Novo cliente criado via %s: %s %s',
      p_source,
      p_first_name,
      p_last_name
    );

    -- Registrar interação de criação
    INSERT INTO public.interactions (
      customer_id,
      type,
      content,
      channel,
      metadata
    ) VALUES (
      v_contact_id,
      'form_submission',
      v_interaction_content,
      'form',
      jsonb_build_object(
        'source', p_source,
        'action', 'created',
        'email', p_email,
        'created_by', v_caller_uid
      )
    );

    RETURN QUERY SELECT 
      v_contact_id,
      v_is_new,
      NULL::customer_status,
      'Novo contato criado com sucesso'::TEXT;

  -- CASO 2: Contato JÁ EXISTE - ATUALIZAR E REENGAJAR
  ELSE
    v_contact_id := v_existing_contact.id;
    v_is_new := FALSE;

    -- VALIDAÇÃO DE AUTORIZAÇÃO para modificar contato existente
    -- Apenas usuários privilegiados OU o próprio assigned_to podem modificar
    IF v_caller_uid IS NOT NULL AND NOT v_is_privileged THEN
      IF v_existing_contact.assigned_to IS NOT NULL 
         AND v_existing_contact.assigned_to != v_caller_uid THEN
        RAISE EXCEPTION 'Não autorizado: você não pode modificar contatos atribuídos a outros usuários';
      END IF;
    END IF;

    -- Atualizar informações se houver mudanças
    -- Limitar campos que podem ser atualizados por usuários não privilegiados
    IF v_is_privileged THEN
      -- Usuários privilegiados podem atualizar todos os campos
      UPDATE public.contacts
      SET 
        first_name = COALESCE(p_first_name, first_name),
        last_name = COALESCE(p_last_name, last_name),
        phone = COALESCE(p_phone, phone),
        company = COALESCE(p_company, company),
        organization_id = COALESCE(p_organization_id, organization_id),
        assigned_to = COALESCE(p_assigned_to, assigned_to),
        last_contact_date = NOW(),
        status = CASE 
          WHEN status IN ('inactive', 'churned') THEN 'lead'
          ELSE status
        END
      WHERE id = v_contact_id;
    ELSE
      -- Usuários regulares só podem atualizar campos básicos, não assigned_to ou organization
      UPDATE public.contacts
      SET 
        first_name = COALESCE(p_first_name, first_name),
        last_name = COALESCE(p_last_name, last_name),
        phone = COALESCE(p_phone, phone),
        company = COALESCE(p_company, company),
        last_contact_date = NOW(),
        status = CASE 
          WHEN status IN ('inactive', 'churned') THEN 'lead'
          ELSE status
        END
      WHERE id = v_contact_id;
    END IF;

    -- Determinar mensagem baseado no status anterior
    v_interaction_content := CASE
      WHEN v_existing_contact.status = 'churned' THEN 
        format('Cliente retornou após churn! Última interação: %s', 
          COALESCE(v_existing_contact.last_contact_date::TEXT, 'nunca'))
      WHEN v_existing_contact.status = 'inactive' THEN
        format('Cliente inativo voltou a interagir! Última interação: %s',
          COALESCE(v_existing_contact.last_contact_date::TEXT, 'nunca'))
      WHEN v_existing_contact.status = 'customer' THEN
        'Cliente existente enviou novo contato'
      ELSE
        'Lead existente voltou a demonstrar interesse'
    END;

    -- Registrar interação de retorno
    INSERT INTO public.interactions (
      customer_id,
      type,
      content,
      channel,
      metadata
    ) VALUES (
      v_contact_id,
      'form_submission',
      v_interaction_content,
      'form',
      jsonb_build_object(
        'source', p_source,
        'action', 'returned',
        'previous_status', v_existing_contact.status,
        'days_since_last_contact', 
          EXTRACT(DAY FROM NOW() - v_existing_contact.last_contact_date),
        'modified_by', v_caller_uid
      )
    );

    RETURN QUERY SELECT 
      v_contact_id,
      v_is_new,
      v_existing_contact.status,
      format('Contato existente atualizado. Status anterior: %s', 
        v_existing_contact.status)::TEXT;
  END IF;

END;
$$;