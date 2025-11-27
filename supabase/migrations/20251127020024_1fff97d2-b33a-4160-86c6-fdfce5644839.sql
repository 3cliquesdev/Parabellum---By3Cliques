-- Criar tabela whatsapp_instances para gestão de instâncias Evolution API
CREATE TABLE public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  instance_name TEXT UNIQUE NOT NULL,
  api_url TEXT NOT NULL,
  api_token TEXT NOT NULL,
  phone_number TEXT,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'qr_pending', 'connected')),
  qr_code_base64 TEXT,
  ai_mode TEXT DEFAULT 'autopilot' CHECK (ai_mode IN ('autopilot', 'copilot', 'disabled')),
  department_id UUID REFERENCES departments(id),
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_whatsapp_instances_user_id ON whatsapp_instances(user_id);
CREATE INDEX idx_whatsapp_instances_department_id ON whatsapp_instances(department_id);
CREATE INDEX idx_whatsapp_instances_instance_name ON whatsapp_instances(instance_name);

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_instances_updated_at
  BEFORE UPDATE ON whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin e Manager podem ver todas as instâncias
CREATE POLICY "admin_manager_can_view_all_instances"
  ON whatsapp_instances
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Admin e Manager podem gerenciar todas as instâncias
CREATE POLICY "admin_manager_can_manage_all_instances"
  ON whatsapp_instances
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Consultores podem ver e gerenciar apenas suas próprias instâncias
CREATE POLICY "consultant_can_view_own_instances"
  ON whatsapp_instances
  FOR SELECT
  USING (
    has_role(auth.uid(), 'consultant'::app_role) AND 
    user_id = auth.uid()
  );

CREATE POLICY "consultant_can_manage_own_instances"
  ON whatsapp_instances
  FOR ALL
  USING (
    has_role(auth.uid(), 'consultant'::app_role) AND 
    user_id = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'consultant'::app_role) AND 
    user_id = auth.uid()
  );