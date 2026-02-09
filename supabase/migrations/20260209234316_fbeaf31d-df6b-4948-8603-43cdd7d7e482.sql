
CREATE TABLE IF NOT EXISTS public.ticket_notification_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_event_id UUID NOT NULL REFERENCES public.ticket_events(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email','in_app')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ticket_event_id, recipient_user_id, channel)
);

CREATE INDEX idx_ticket_notification_sends_event ON ticket_notification_sends(ticket_event_id);
CREATE INDEX idx_ticket_notification_sends_recipient ON ticket_notification_sends(recipient_user_id);

ALTER TABLE ticket_notification_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON ticket_notification_sends FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated can read" ON ticket_notification_sends FOR SELECT TO authenticated USING (true);
