-- ==========================================
-- FASE 3: GOVERNANÇA & AUDITORIA - Triggers
-- ==========================================

-- Trigger para tickets
CREATE TRIGGER audit_tickets_changes
AFTER INSERT OR UPDATE OR DELETE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

-- Trigger para conversations
CREATE TRIGGER audit_conversations_changes
AFTER INSERT OR UPDATE OR DELETE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

-- Trigger para canned_responses
CREATE TRIGGER audit_canned_responses_changes
AFTER INSERT OR UPDATE OR DELETE ON public.canned_responses
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

-- Trigger para contacts
CREATE TRIGGER audit_contacts_changes
AFTER INSERT OR UPDATE OR DELETE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

-- ==========================================
-- FASE 4: SKILL-BASED ROUTING - Tabelas
-- ==========================================

-- Tabela de Skills
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de ligação Profile <-> Skill
CREATE TABLE public.profiles_skills (
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES public.skills(id) ON DELETE CASCADE,
  proficiency_level TEXT DEFAULT 'intermediate',
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (profile_id, skill_id)
);

-- RLS para skills
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view skills" ON public.skills 
FOR SELECT USING (true);

CREATE POLICY "Admin/Manager can manage skills" ON public.skills 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager', 'general_manager')
  )
);

-- RLS para profiles_skills
ALTER TABLE public.profiles_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles_skills" ON public.profiles_skills 
FOR SELECT USING (true);

CREATE POLICY "Admin/Manager can manage profiles_skills" ON public.profiles_skills 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager', 'general_manager')
  )
);

-- Seed inicial de skills
INSERT INTO public.skills (name, description, color) VALUES
('Financeiro', 'Questões de cobrança, reembolso e pagamentos', '#22C55E'),
('Suporte Técnico', 'Problemas técnicos e bugs', '#3B82F6'),
('Vendas', 'Oportunidades comerciais e upgrades', '#F59E0B'),
('Inglês', 'Atendimento em inglês', '#8B5CF6'),
('Retenção', 'Prevenção de churn e clientes insatisfeitos', '#EF4444'),
('Onboarding', 'Implementação e treinamento inicial', '#10B981'),
('Cobrança', 'Recuperação de inadimplência', '#F97316');