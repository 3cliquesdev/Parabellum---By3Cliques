
-- Drop existing policies to recreate with correct definitions
DROP POLICY IF EXISTS "Service role full access" ON public.ticket_notification_sends;
DROP POLICY IF EXISTS "Authenticated can read own" ON public.ticket_notification_sends;
DROP POLICY IF EXISTS "Authenticated can read" ON public.ticket_notification_sends;

CREATE POLICY "Service role full access"
  ON public.ticket_notification_sends FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read own"
  ON public.ticket_notification_sends FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid() OR public.is_manager_or_admin(auth.uid()));

-- Backfill notifications.read
UPDATE public.notifications SET read = false WHERE read IS NULL;

-- Ensure default on notifications.read
ALTER TABLE public.notifications ALTER COLUMN read SET DEFAULT false;
