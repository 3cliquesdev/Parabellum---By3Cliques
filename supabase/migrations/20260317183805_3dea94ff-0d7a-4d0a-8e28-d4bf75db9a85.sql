
-- Drop e recria a política canonical_select_conversations com condição adicional para fila IA
DROP POLICY IF EXISTS "canonical_select_conversations" ON public.conversations;

CREATE POLICY "canonical_select_conversations" ON public.conversations
FOR SELECT USING (
  -- 1. Managers/admins veem tudo
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role, 'general_manager'::app_role, 'support_manager'::app_role, 'cs_manager'::app_role, 'financial_manager'::app_role])
  
  -- 2. Conversas atribuídas ao próprio agente
  OR (assigned_to = auth.uid())
  
  -- 3. Conversas abertas sem atribuição no mesmo departamento do agente
  OR (
    status = 'open'::conversation_status
    AND assigned_to IS NULL
    AND has_any_role(auth.uid(), ARRAY['sales_rep'::app_role, 'support_agent'::app_role, 'financial_agent'::app_role, 'consultant'::app_role])
    AND department = (SELECT profiles.department FROM profiles WHERE profiles.id = auth.uid())
  )
  
  -- 4. Conversas abertas sem atribuição e sem departamento
  OR (
    status = 'open'::conversation_status
    AND assigned_to IS NULL
    AND department IS NULL
    AND has_any_role(auth.uid(), ARRAY['sales_rep'::app_role, 'support_agent'::app_role, 'financial_agent'::app_role, 'consultant'::app_role])
  )
  
  -- 5. NOVO: Fila IA — qualquer agente autenticado vê conversas em autopilot/waiting_human não fechadas
  OR (
    ai_mode IN ('autopilot', 'waiting_human')
    AND status != 'closed'::conversation_status
    AND assigned_to IS NULL
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role, 'general_manager'::app_role, 'support_manager'::app_role, 'cs_manager'::app_role, 'financial_manager'::app_role, 'sales_rep'::app_role, 'support_agent'::app_role, 'financial_agent'::app_role, 'consultant'::app_role])
  )
  
  -- 6. Webchat com session token
  OR (
    channel = 'web_chat'::conversation_channel
    AND session_token IS NOT NULL
    AND session_token = ((current_setting('request.headers'::text, true))::json ->> 'x-session-token'::text)
  )
);
