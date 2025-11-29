-- ============================================
-- CORREÇÕES DE SEGURANÇA COMPLETAS
-- ============================================

-- ====== FASE 1: QUOTES E QUOTE_ITEMS ======

DROP POLICY IF EXISTS "public_can_view_quotes_with_token" ON public.quotes;

CREATE POLICY "quotes_token_based_select"
ON public.quotes
FOR SELECT
USING (
  signature_token IS NOT NULL 
  AND signature_token = (current_setting('request.headers'::text, true)::json->>'x-signature-token')
);

CREATE POLICY "authenticated_can_manage_quotes"
ON public.quotes
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "public_can_view_quote_items" ON public.quote_items;

CREATE POLICY "quote_items_via_valid_token"
ON public.quote_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
    AND q.signature_token IS NOT NULL
    AND q.signature_token = (current_setting('request.headers'::text, true)::json->>'x-signature-token')
  )
);

CREATE POLICY "authenticated_can_manage_quote_items"
ON public.quote_items
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- ====== FASE 2: CONVERSATION_RATINGS ======

DROP POLICY IF EXISTS "public_can_insert_ratings" ON public.conversation_ratings;

CREATE POLICY "ratings_require_valid_session"
ON public.conversation_ratings
FOR INSERT
WITH CHECK (
  (auth.uid() IS NOT NULL)
  OR
  (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_ratings.conversation_id
      AND c.channel = 'web_chat'
      AND c.session_token IS NOT NULL
      AND c.session_token = (current_setting('request.headers'::text, true)::json->>'x-session-token')
    )
  )
);

-- ====== FASE 3: DELIVERY_GROUPS ======

DROP POLICY IF EXISTS "authenticated_can_view_delivery_groups" ON public.delivery_groups;
DROP POLICY IF EXISTS "admin_manager_can_manage_delivery_groups" ON public.delivery_groups;

CREATE POLICY "authenticated_can_view_delivery_groups"
ON public.delivery_groups
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_manager_can_manage_delivery_groups"
ON public.delivery_groups
FOR ALL
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'general_manager')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'general_manager')
);

-- ====== FASE 4: ONBOARDING_PLAYBOOKS ======

DROP POLICY IF EXISTS "authenticated_can_view_playbooks" ON public.onboarding_playbooks;

CREATE POLICY "authenticated_can_view_playbooks"
ON public.onboarding_playbooks
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- ====== FASE 5: DEPARTMENTS ======

DROP POLICY IF EXISTS "anon_can_view_active_departments" ON public.departments;
DROP POLICY IF EXISTS "authenticated_can_view_departments" ON public.departments;

CREATE POLICY "anon_can_view_active_departments"
ON public.departments
FOR SELECT
USING (is_active = true);

CREATE POLICY "authenticated_can_view_all_departments"
ON public.departments
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- ====== FASE 6: FORMS ======

DROP POLICY IF EXISTS "authenticated_can_view_forms" ON public.forms;

CREATE POLICY "authenticated_can_view_forms"
ON public.forms
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- ====== FASE 7: TICKET_COMMENTS ======

DROP POLICY IF EXISTS "authenticated_can_insert_ticket_comments" ON public.ticket_comments;

CREATE POLICY "can_comment_on_accessible_tickets"
ON public.ticket_comments
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'support_manager') OR
  has_role(auth.uid(), 'financial_manager') OR
  (
    has_role(auth.uid(), 'support_agent') AND
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_comments.ticket_id
      AND t.assigned_to = auth.uid()
    )
  )
);

-- ====== FASE 8: FUNCTION SEARCH_PATH ======

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_cadences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_enrollments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_departments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_availability_status_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.availability_status IS DISTINCT FROM OLD.availability_status THEN
    NEW.last_status_change = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_conversation_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL) 
     OR (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    NEW.last_message_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_table_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text, 
  p_action_type text, 
  p_max_requests integer DEFAULT 10, 
  p_window_minutes integer DEFAULT 1, 
  p_block_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_record RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_record FROM public.rate_limits 
  WHERE identifier = p_identifier AND action_type = p_action_type
  FOR UPDATE;
  
  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (identifier, action_type, request_count, window_start)
    VALUES (p_identifier, p_action_type, 1, v_now);
    RETURN TRUE;
  END IF;
  
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
    RETURN FALSE;
  END IF;
  
  IF v_record.window_start < v_now - (p_window_minutes || ' minutes')::interval THEN
    UPDATE public.rate_limits SET 
      request_count = 1, 
      window_start = v_now,
      blocked_until = NULL
    WHERE identifier = p_identifier AND action_type = p_action_type;
    RETURN TRUE;
  END IF;
  
  IF v_record.request_count >= p_max_requests THEN
    UPDATE public.rate_limits SET 
      blocked_until = v_now + (p_block_minutes || ' minutes')::interval
    WHERE identifier = p_identifier AND action_type = p_action_type;
    RETURN FALSE;
  END IF;
  
  UPDATE public.rate_limits SET 
    request_count = request_count + 1
  WHERE identifier = p_identifier AND action_type = p_action_type;
  
  RETURN TRUE;
END;
$$;