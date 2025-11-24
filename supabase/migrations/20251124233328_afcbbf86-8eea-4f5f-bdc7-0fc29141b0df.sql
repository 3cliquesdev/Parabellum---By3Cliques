-- Create sales_goals table
CREATE TABLE public.sales_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('individual', 'team', 'company')),
  target_value NUMERIC NOT NULL CHECK (target_value > 0),
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL CHECK (period_year >= 2024),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  department department_type,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  UNIQUE(assigned_to, period_month, period_year)
);

-- Enable RLS
ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "admins_can_manage_goals"
ON public.sales_goals
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "managers_can_view_goals"
ON public.sales_goals
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "sales_rep_can_view_own_goals"
ON public.sales_goals
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'sales_rep'::app_role) 
  AND assigned_to = auth.uid()
);

-- Trigger for updated_at
CREATE TRIGGER update_sales_goals_updated_at
BEFORE UPDATE ON public.sales_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create goal_milestones table for tracking achievements
CREATE TABLE public.goal_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.sales_goals(id) ON DELETE CASCADE,
  milestone_percentage INTEGER NOT NULL CHECK (milestone_percentage IN (25, 50, 75, 100)),
  achieved_at TIMESTAMP WITH TIME ZONE,
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(goal_id, milestone_percentage)
);

-- Enable RLS
ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;

-- RLS Policies for milestones
CREATE POLICY "authenticated_can_view_milestones"
ON public.goal_milestones
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "admins_can_manage_milestones"
ON public.goal_milestones
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));