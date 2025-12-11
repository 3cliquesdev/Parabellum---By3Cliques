-- Sprint 1: Adicionar campo external_ids JSONB na tabela contacts
-- Para armazenar identificadores externos de múltiplos canais (whatsapp, instagram, facebook, etc.)

ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS external_ids JSONB DEFAULT '{}'::jsonb;

-- Migrar dados existentes de whatsapp_id para o novo campo external_ids
UPDATE public.contacts 
SET external_ids = jsonb_set(
  COALESCE(external_ids, '{}'::jsonb), 
  '{whatsapp}', 
  to_jsonb(whatsapp_id)
)
WHERE whatsapp_id IS NOT NULL AND whatsapp_id != '';

-- Criar índice GIN para buscas eficientes em external_ids
CREATE INDEX IF NOT EXISTS idx_contacts_external_ids ON public.contacts USING GIN (external_ids);

-- Comentário para documentação
COMMENT ON COLUMN public.contacts.external_ids IS 'JSONB com IDs externos por canal: {whatsapp: "55...", instagram: "123...", facebook: "456...", email_thread: "msg-id..."}';

-- Criar função para resolução de identidade centralizada
CREATE OR REPLACE FUNCTION public.resolve_contact_by_identity(
  p_phone_e164 TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_external_id TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
BEGIN
  -- 1. Tentar por telefone (mais confiável para WhatsApp)
  IF p_phone_e164 IS NOT NULL THEN
    SELECT id INTO v_contact_id 
    FROM contacts 
    WHERE phone = p_phone_e164 
       OR whatsapp_id = p_phone_e164
       OR external_ids->>'whatsapp' = p_phone_e164
    LIMIT 1;
    
    IF v_contact_id IS NOT NULL THEN
      RETURN v_contact_id;
    END IF;
  END IF;
  
  -- 2. Tentar por email
  IF p_email IS NOT NULL THEN
    SELECT id INTO v_contact_id 
    FROM contacts 
    WHERE LOWER(email) = LOWER(p_email)
    LIMIT 1;
    
    IF v_contact_id IS NOT NULL THEN
      RETURN v_contact_id;
    END IF;
  END IF;
  
  -- 3. Tentar por external_id específico do canal
  IF p_external_id IS NOT NULL AND p_channel IS NOT NULL THEN
    SELECT id INTO v_contact_id 
    FROM contacts 
    WHERE external_ids->>p_channel = p_external_id
    LIMIT 1;
    
    IF v_contact_id IS NOT NULL THEN
      RETURN v_contact_id;
    END IF;
  END IF;
  
  -- Não encontrou - retorna NULL
  RETURN NULL;
END;
$$;