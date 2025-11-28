-- =============================================
-- SUB-FASE 2.1: Sales Engagement Schema
-- =============================================

-- 1. CADENCES: O fluxo de prospecção
CREATE TABLE IF NOT EXISTS public.cadences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. CADENCE_STEPS: Os passos da cadência
CREATE TABLE IF NOT EXISTS public.cadence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id UUID NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  day_offset INTEGER NOT NULL DEFAULT 0,
  step_type TEXT NOT NULL CHECK (step_type IN ('email', 'whatsapp', 'call', 'linkedin', 'task')),
  is_automated BOOLEAN NOT NULL DEFAULT false,
  template_id UUID REFERENCES public.email_templates(id),
  message_template TEXT,
  task_title TEXT,
  task_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_step_position CHECK (position >= 0),
  CONSTRAINT valid_day_offset CHECK (day_offset >= 0)
);

-- 3. CADENCE_ENROLLMENTS: Quem está na cadência
CREATE TABLE IF NOT EXISTS public.cadence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  cadence_id UUID NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  enrolled_by UUID REFERENCES public.profiles(id),
  current_step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'replied', 'bounced')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  next_step_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(contact_id, cadence_id)
);

-- 4. CADENCE_TASKS: Fila de trabalho gerada
CREATE TABLE IF NOT EXISTS public.cadence_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.cadence_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.cadence_steps(id),
  contact_id UUID NOT NULL REFERENCES public.contacts(id),
  assigned_to UUID NOT NULL REFERENCES public.profiles(id),
  task_type TEXT NOT NULL CHECK (task_type IN ('email', 'whatsapp', 'call', 'linkedin', 'task')),
  title TEXT NOT NULL,
  description TEXT,
  template_content TEXT,
  scheduled_for DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped', 'cancelled')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- ÍNDICES DE PERFORMANCE
-- =============================================

-- Cadences
CREATE INDEX IF NOT EXISTS idx_cadences_active ON public.cadences(is_active);
CREATE INDEX IF NOT EXISTS idx_cadences_created_by ON public.cadences(created_by);

-- Cadence Steps
CREATE INDEX IF NOT EXISTS idx_steps_cadence ON public.cadence_steps(cadence_id);
CREATE INDEX IF NOT EXISTS idx_steps_position ON public.cadence_steps(cadence_id, position);

-- Enrollments
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.cadence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_next_step ON public.cadence_enrollments(next_step_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_enrollments_contact ON public.cadence_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_cadence ON public.cadence_enrollments(cadence_id);

-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON public.cadence_tasks(scheduled_for, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.cadence_tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_enrollment ON public.cadence_tasks(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contact ON public.cadence_tasks(contact_id);

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE public.cadences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_tasks ENABLE ROW LEVEL SECURITY;

-- CADENCES POLICIES
-- Admin/Manager: Full CRUD
CREATE POLICY "admin_manager_can_manage_cadences"
ON public.cadences
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Sales Rep: Can view all cadences
CREATE POLICY "sales_rep_can_view_cadences"
ON public.cadences
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'sales_rep'::app_role));

-- CADENCE_STEPS POLICIES
-- Admin/Manager: Full CRUD
CREATE POLICY "admin_manager_can_manage_steps"
ON public.cadence_steps
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- All authenticated: Can view steps
CREATE POLICY "authenticated_can_view_steps"
ON public.cadence_steps
FOR SELECT
TO authenticated
USING (true);

-- CADENCE_ENROLLMENTS POLICIES
-- Admin/Manager: Can view all enrollments
CREATE POLICY "admin_manager_can_view_all_enrollments"
ON public.cadence_enrollments
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Sales Rep: Can view and manage enrollments where contact is assigned to them
CREATE POLICY "sales_rep_can_manage_own_enrollments"
ON public.cadence_enrollments
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'sales_rep'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = cadence_enrollments.contact_id 
    AND c.assigned_to = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'sales_rep'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = cadence_enrollments.contact_id 
    AND c.assigned_to = auth.uid()
  )
);

-- Admin/Manager: Can insert/update/delete all enrollments
CREATE POLICY "admin_manager_can_manage_all_enrollments"
ON public.cadence_enrollments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- CADENCE_TASKS POLICIES
-- Admin/Manager: Can view all tasks
CREATE POLICY "admin_manager_can_view_all_tasks"
ON public.cadence_tasks
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Sales Rep: Can view and manage tasks assigned to them
CREATE POLICY "sales_rep_can_manage_own_tasks"
ON public.cadence_tasks
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'sales_rep'::app_role) AND assigned_to = auth.uid())
WITH CHECK (has_role(auth.uid(), 'sales_rep'::app_role) AND assigned_to = auth.uid());

-- Admin/Manager: Can insert/update/delete all tasks
CREATE POLICY "admin_manager_can_manage_all_tasks"
ON public.cadence_tasks
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at on cadences
CREATE OR REPLACE FUNCTION update_cadences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cadences_updated_at
BEFORE UPDATE ON public.cadences
FOR EACH ROW
EXECUTE FUNCTION update_cadences_updated_at();

-- Auto-update updated_at on enrollments
CREATE OR REPLACE FUNCTION update_enrollments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_enrollments_updated_at
BEFORE UPDATE ON public.cadence_enrollments
FOR EACH ROW
EXECUTE FUNCTION update_enrollments_updated_at();