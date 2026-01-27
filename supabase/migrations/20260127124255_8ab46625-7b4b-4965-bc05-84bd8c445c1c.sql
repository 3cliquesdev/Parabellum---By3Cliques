-- Função para backfill de emails nas conversas
-- Varre mensagens que contêm @ e verifica se o email existe como customer na base
CREATE OR REPLACE FUNCTION backfill_emails_from_messages()
RETURNS TABLE(
  emails_found integer,
  contacts_updated integer,
  conversations_moved integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emails_found integer := 0;
  v_contacts_updated integer := 0;
  v_conversations_moved integer := 0;
  v_suporte_dept_id uuid := '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
  r RECORD;
BEGIN
  -- Loop por mensagens com @ que são de contatos
  FOR r IN 
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.content,
      c.id as contact_id,
      c.email as current_email,
      c.status as current_status,
      -- Extrair email da mensagem (removendo espaços e quebras de linha)
      (regexp_matches(
        LOWER(regexp_replace(m.content, E'\\s+', '', 'g')), 
        '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
      ))[1] as extracted_email
    FROM messages m
    JOIN conversations cv ON cv.id = m.conversation_id
    JOIN contacts c ON c.id = cv.contact_id
    WHERE m.sender_type = 'contact'
      AND m.content LIKE '%@%'
      AND (c.email IS NULL OR c.status != 'customer')
    ORDER BY m.conversation_id, m.created_at DESC
  LOOP
    v_emails_found := v_emails_found + 1;
    
    -- Verificar se email existe em outro contato com status customer
    IF EXISTS (
      SELECT 1 FROM contacts 
      WHERE email = r.extracted_email 
      AND status = 'customer'
    ) THEN
      -- Email pertence a cliente existente - atualizar contato atual
      UPDATE contacts 
      SET 
        email = r.extracted_email,
        status = 'customer',
        source = COALESCE(source, 'backfill_email')
      WHERE id = r.contact_id
        AND (email IS NULL OR email != r.extracted_email);
      
      IF FOUND THEN
        v_contacts_updated := v_contacts_updated + 1;
      END IF;
      
      -- Mover conversa para Suporte
      UPDATE conversations 
      SET department = v_suporte_dept_id
      WHERE id = r.conversation_id
        AND (department IS NULL OR department != v_suporte_dept_id);
      
      IF FOUND THEN
        v_conversations_moved := v_conversations_moved + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_emails_found, v_contacts_updated, v_conversations_moved;
END;
$$;

-- Permitir que a função seja chamada
GRANT EXECUTE ON FUNCTION backfill_emails_from_messages() TO authenticated;
GRANT EXECUTE ON FUNCTION backfill_emails_from_messages() TO service_role;