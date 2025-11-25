-- Create public_ticket_portal_config table
CREATE TABLE public.public_ticket_portal_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  name TEXT NOT NULL DEFAULT 'Portal Público de Tickets',
  description TEXT DEFAULT 'Permite clientes abrirem tickets sem fazer login',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure only 1 configuration record (singleton pattern)
CREATE UNIQUE INDEX idx_single_portal_config ON public.public_ticket_portal_config ((true));

-- Trigger for updated_at
CREATE TRIGGER update_portal_config_updated_at
  BEFORE UPDATE ON public.public_ticket_portal_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial configuration (portal active by default)
INSERT INTO public.public_ticket_portal_config (is_active, name, description)
VALUES (true, 'Portal Público de Tickets', 'Permite clientes abrirem tickets sem fazer login');

-- Enable RLS
ALTER TABLE public.public_ticket_portal_config ENABLE ROW LEVEL SECURITY;

-- Admin/Manager can manage
CREATE POLICY "admin_manager_can_manage_portal_config"
  ON public.public_ticket_portal_config
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Everyone can view (to check if portal is active)
CREATE POLICY "anyone_can_view_portal_config"
  ON public.public_ticket_portal_config
  FOR SELECT
  USING (true);