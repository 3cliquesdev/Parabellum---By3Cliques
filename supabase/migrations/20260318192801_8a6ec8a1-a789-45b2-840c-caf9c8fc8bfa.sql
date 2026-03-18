CREATE POLICY "ai_queue_select_messages" ON public.messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
      AND c.status = 'open'
      AND c.assigned_to IS NULL
      AND c.ai_mode IN ('autopilot', 'waiting_human')
      AND has_any_role(auth.uid(), ARRAY['sales_rep','support_agent','financial_agent','consultant']::app_role[])
  )
);