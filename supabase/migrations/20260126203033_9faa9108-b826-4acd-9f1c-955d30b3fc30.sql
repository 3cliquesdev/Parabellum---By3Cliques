-- Table: team_settings (configurações avançadas do time)
CREATE TABLE public.team_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE UNIQUE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  max_concurrent_chats INTEGER DEFAULT 5,
  auto_assign BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: team_channels (vincular times a canais de atendimento)
CREATE TABLE public.team_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.support_channels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(team_id, channel_id)
);

-- Enable RLS
ALTER TABLE public.team_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_channels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_settings
CREATE POLICY "Authenticated users can view team_settings"
ON public.team_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and managers can manage team_settings"
ON public.team_settings FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'general_manager', 'support_manager', 'cs_manager')
  )
);

-- RLS Policies for team_channels
CREATE POLICY "Authenticated users can view team_channels"
ON public.team_channels FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and managers can manage team_channels"
ON public.team_channels FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'general_manager', 'support_manager', 'cs_manager')
  )
);

-- Trigger for updated_at on team_settings
CREATE TRIGGER update_team_settings_updated_at
BEFORE UPDATE ON public.team_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();