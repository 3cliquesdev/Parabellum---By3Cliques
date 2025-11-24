-- Fase 2: Database Function para Upsert Inteligente de Contatos
-- Esta função implementa a lógica anti-duplicidade com registro automático de interações

CREATE OR REPLACE FUNCTION public.upsert_contact_with_interaction(
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'form'
)
RETURNS TABLE (
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
BEGIN
  -- Validação básica de email
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email é obrigatório para upsert';
  END IF;

  -- Verificar se o contato já existe
  SELECT id, status, first_name, last_name, last_contact_date
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
        'email', p_email
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

    -- Atualizar informações se houver mudanças
    UPDATE public.contacts
    SET 
      first_name = COALESCE(p_first_name, first_name),
      last_name = COALESCE(p_last_name, last_name),
      phone = COALESCE(p_phone, phone),
      company = COALESCE(p_company, company),
      organization_id = COALESCE(p_organization_id, organization_id),
      last_contact_date = NOW(),
      -- Reativar contato se estava inativo ou churned
      status = CASE 
        WHEN status IN ('inactive', 'churned') THEN 'lead'
        ELSE status
      END
    WHERE id = v_contact_id;

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
          EXTRACT(DAY FROM NOW() - v_existing_contact.last_contact_date)
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

COMMENT ON FUNCTION public.upsert_contact_with_interaction IS 
  'Cria ou atualiza contato com lógica anti-duplicidade. Registra interações automaticamente.';