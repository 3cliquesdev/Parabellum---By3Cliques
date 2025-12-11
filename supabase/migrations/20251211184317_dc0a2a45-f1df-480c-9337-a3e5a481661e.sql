-- Sprint 1 Part 1: Criar tabela inbox_view

CREATE TABLE public.inbox_view (
  conversation_id UUID PRIMARY KEY,
  contact_id UUID NOT NULL,
  contact_name TEXT,
  contact_avatar TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  last_snippet TEXT,
  last_channel TEXT,
  last_sender_type TEXT,
  unread_count INTEGER DEFAULT 0,
  channels TEXT[] DEFAULT '{}',
  has_audio BOOLEAN DEFAULT false,
  has_attachments BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'open',
  ai_mode TEXT DEFAULT 'autopilot',
  assigned_to UUID,
  department UUID,
  sla_status TEXT DEFAULT 'ok',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para queries comuns
CREATE INDEX idx_inbox_view_last_message ON inbox_view(last_message_at DESC);
CREATE INDEX idx_inbox_view_status ON inbox_view(status);
CREATE INDEX idx_inbox_view_assigned_to ON inbox_view(assigned_to);
CREATE INDEX idx_inbox_view_ai_mode ON inbox_view(ai_mode);
CREATE INDEX idx_inbox_view_department ON inbox_view(department);
CREATE INDEX idx_inbox_view_sla ON inbox_view(sla_status);
CREATE INDEX idx_inbox_view_has_audio ON inbox_view(has_audio) WHERE has_audio = true;
CREATE INDEX idx_inbox_view_has_attachments ON inbox_view(has_attachments) WHERE has_attachments = true;

-- Habilitar RLS
ALTER TABLE inbox_view ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "admin_manager_full_access_inbox_view" ON inbox_view
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "support_agent_view_assigned_inbox" ON inbox_view
FOR SELECT USING (
  has_role(auth.uid(), 'support_agent'::app_role) AND 
  (assigned_to = auth.uid() OR assigned_to IS NULL)
);

CREATE POLICY "sales_rep_view_sales_inbox" ON inbox_view
FOR SELECT USING (
  has_role(auth.uid(), 'sales_rep'::app_role) AND 
  (assigned_to = auth.uid() OR department IN (
    SELECT id FROM departments WHERE name IN ('Comercial', 'Vendas')
  ))
);

CREATE POLICY "cs_manager_view_inbox" ON inbox_view
FOR SELECT USING (has_role(auth.uid(), 'cs_manager'::app_role));

CREATE POLICY "support_manager_view_inbox" ON inbox_view
FOR SELECT USING (has_role(auth.uid(), 'support_manager'::app_role));

CREATE POLICY "general_manager_view_inbox" ON inbox_view
FOR SELECT USING (has_role(auth.uid(), 'general_manager'::app_role));