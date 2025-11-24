-- FASE 1: CORRIGIR RLS POLICIES DE PROFILES
-- Remover policy restritiva que bloqueia criação automática
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

-- Criar nova policy que permite trigger criar profiles automaticamente
CREATE POLICY "Allow profile creation via trigger and admins"
ON public.profiles FOR INSERT
WITH CHECK (
  -- Permite trigger (quando auth.uid() é NULL durante criação automática)
  -- OU permite admins criarem manualmente
  auth.uid() IS NULL OR has_role(auth.uid(), 'admin'::app_role)
);

-- Criar profiles para usuários existentes que não têm profile
INSERT INTO public.profiles (id, full_name, job_title)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', 'Usuário ' || au.email),
  COALESCE(au.raw_user_meta_data->>'job_title', 'Vendedor')
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
);

-- FASE 2: ATUALIZAR FUNÇÃO UPSERT_CONTACT_WITH_INTERACTION
-- Adicionar suporte ao parâmetro p_assigned_to
CREATE OR REPLACE FUNCTION public.upsert_contact_with_interaction(
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'form',
  p_assigned_to UUID DEFAULT NULL  -- NOVO PARÂMETRO
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
      assigned_to,  -- NOVO CAMPO
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
      p_assigned_to,  -- NOVO VALOR
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
      assigned_to = COALESCE(p_assigned_to, assigned_to),  -- NOVO CAMPO
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