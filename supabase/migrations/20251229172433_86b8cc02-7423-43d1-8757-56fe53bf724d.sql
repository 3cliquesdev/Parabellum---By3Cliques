-- =====================================================
-- FASE 1: Tabela ticket_events para histórico completo
-- =====================================================

-- Criar tabela de eventos do ticket
CREATE TABLE public.ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'created', 'assigned', 'status_changed', 'priority_changed', 'comment_added', 'transferred', 'merged'
  actor_id UUID REFERENCES public.profiles(id),
  old_value TEXT,
  new_value TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca rápida por ticket
CREATE INDEX idx_ticket_events_ticket_id ON public.ticket_events(ticket_id);
CREATE INDEX idx_ticket_events_created_at ON public.ticket_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;

-- Policies (mesma lógica dos tickets)
CREATE POLICY "ticket_events_select_policy" ON public.ticket_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ticket_events_insert_policy" ON public.ticket_events
  FOR INSERT TO authenticated WITH CHECK (true);

-- =====================================================
-- FASE 2: Trigger para registrar criação de ticket
-- =====================================================

CREATE OR REPLACE FUNCTION log_ticket_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.ticket_events (
    ticket_id,
    event_type,
    actor_id,
    new_value,
    metadata
  ) VALUES (
    NEW.id,
    'created',
    NEW.created_by,
    NEW.status,
    jsonb_build_object(
      'subject', NEW.subject,
      'priority', NEW.priority,
      'category', NEW.category,
      'channel', NEW.channel
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_log_ticket_created
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_created();

-- =====================================================
-- FASE 3: Trigger para registrar mudanças no ticket
-- =====================================================

CREATE OR REPLACE FUNCTION log_ticket_updated()
RETURNS TRIGGER AS $$
BEGIN
  -- Status changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.ticket_events (ticket_id, event_type, actor_id, old_value, new_value)
    VALUES (NEW.id, 'status_changed', auth.uid(), OLD.status, NEW.status);
  END IF;

  -- Priority changed
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO public.ticket_events (ticket_id, event_type, actor_id, old_value, new_value)
    VALUES (NEW.id, 'priority_changed', auth.uid(), OLD.priority, NEW.priority);
  END IF;

  -- Assignment changed
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO public.ticket_events (
      ticket_id, 
      event_type, 
      actor_id, 
      old_value, 
      new_value,
      metadata
    )
    VALUES (
      NEW.id, 
      'assigned', 
      auth.uid(), 
      OLD.assigned_to::text, 
      NEW.assigned_to::text,
      jsonb_build_object('previous_agent', OLD.assigned_to, 'new_agent', NEW.assigned_to)
    );
  END IF;

  -- Department changed
  IF OLD.department_id IS DISTINCT FROM NEW.department_id THEN
    INSERT INTO public.ticket_events (ticket_id, event_type, actor_id, old_value, new_value)
    VALUES (NEW.id, 'transferred', auth.uid(), OLD.department_id, NEW.department_id);
  END IF;

  -- Merged
  IF OLD.merged_to_ticket_id IS DISTINCT FROM NEW.merged_to_ticket_id AND NEW.merged_to_ticket_id IS NOT NULL THEN
    INSERT INTO public.ticket_events (ticket_id, event_type, actor_id, new_value, metadata)
    VALUES (NEW.id, 'merged', auth.uid(), NEW.merged_to_ticket_id::text, 
      jsonb_build_object('merged_to_ticket_number', NEW.merged_to_ticket_number));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_log_ticket_updated
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_updated();

-- =====================================================
-- FASE 4: Trigger para registrar comentários
-- =====================================================

CREATE OR REPLACE FUNCTION log_ticket_comment_added()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.ticket_events (
    ticket_id,
    event_type,
    actor_id,
    metadata
  ) VALUES (
    NEW.ticket_id,
    'comment_added',
    NEW.created_by,
    jsonb_build_object(
      'comment_id', NEW.id,
      'is_internal', NEW.is_internal,
      'content_preview', LEFT(NEW.content, 100)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_log_ticket_comment_added
  AFTER INSERT ON public.ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_comment_added();

-- =====================================================
-- FASE 5: Enable Realtime for ticket_comments
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_comments;