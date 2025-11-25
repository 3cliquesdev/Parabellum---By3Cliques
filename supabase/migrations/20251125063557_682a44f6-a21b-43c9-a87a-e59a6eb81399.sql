-- FASE 1: Criar tabela onboarding_playbooks e sistema de templates
-- Tabela para armazenar playbooks/templates de onboarding
CREATE TABLE IF NOT EXISTS public.onboarding_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  flow_definition JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  is_template BOOLEAN DEFAULT false,
  execution_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index para performance
CREATE INDEX idx_playbooks_product ON public.onboarding_playbooks(product_id);
CREATE INDEX idx_playbooks_active ON public.onboarding_playbooks(is_active);
CREATE INDEX idx_playbooks_template ON public.onboarding_playbooks(is_template);

-- Trigger para updated_at
CREATE TRIGGER set_playbooks_updated_at
  BEFORE UPDATE ON public.onboarding_playbooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.onboarding_playbooks ENABLE ROW LEVEL SECURITY;

-- Admin/Manager podem gerenciar playbooks
CREATE POLICY "Admin and Manager can manage playbooks"
  ON public.onboarding_playbooks
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Todos podem visualizar playbooks ativos (para executar)
CREATE POLICY "Everyone can view active playbooks"
  ON public.onboarding_playbooks
  FOR SELECT
  USING (is_active = true);

-- FASE 5: Função para executar playbook automaticamente quando deal é ganho
CREATE OR REPLACE FUNCTION public.execute_onboarding_playbook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_playbook_id UUID;
  v_flow JSONB;
  v_node JSONB;
  v_position INTEGER := 0;
BEGIN
  -- Apenas processa deals ganhos
  IF NEW.status = 'won' AND (OLD.status IS NULL OR OLD.status != 'won') THEN
    
    -- Buscar playbook associado ao produto
    SELECT id, flow_definition INTO v_playbook_id, v_flow
    FROM public.onboarding_playbooks
    WHERE product_id = NEW.product_id
    AND is_active = true
    LIMIT 1;
    
    IF v_playbook_id IS NOT NULL THEN
      -- Processar cada node do fluxo
      FOR v_node IN SELECT * FROM jsonb_array_elements(v_flow->'nodes')
      LOOP
        -- Criar journey steps baseado nos nodes (exceto nodes de delay)
        IF v_node->>'type' != 'delay' THEN
          INSERT INTO public.customer_journey_steps (
            contact_id,
            step_name,
            is_critical,
            completed,
            position,
            notes
          ) VALUES (
            NEW.contact_id,
            v_node->'data'->>'label',
            (v_node->>'type' IN ('task', 'call')), -- Tasks e calls são críticas
            false,
            v_position,
            jsonb_build_object(
              'playbook_id', v_playbook_id,
              'node_type', v_node->>'type',
              'node_data', v_node->'data'
            )::text
          );
          
          v_position := v_position + 1;
        END IF;
      END LOOP;
      
      -- Incrementar contador de execuções
      UPDATE public.onboarding_playbooks
      SET execution_count = execution_count + 1
      WHERE id = v_playbook_id;
      
      -- Log da execução
      INSERT INTO public.interactions (
        customer_id,
        type,
        content,
        channel,
        metadata
      ) VALUES (
        NEW.contact_id,
        'note',
        'Playbook de onboarding iniciado automaticamente: ' || (SELECT name FROM onboarding_playbooks WHERE id = v_playbook_id),
        'other',
        jsonb_build_object(
          'playbook_id', v_playbook_id,
          'trigger', 'deal_won',
          'deal_id', NEW.id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Aplicar trigger em deals
DROP TRIGGER IF EXISTS on_deal_won_execute_playbook ON public.deals;
CREATE TRIGGER on_deal_won_execute_playbook
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.execute_onboarding_playbook();

-- Seed: Templates pré-configurados
INSERT INTO public.onboarding_playbooks (name, description, flow_definition, is_active, is_template) VALUES
('Template: SaaS Básico', 'Onboarding padrão para produtos SaaS com suporte básico', '{"nodes":[{"id":"1","type":"email","position":{"x":100,"y":100},"data":{"label":"Email de Boas-vindas","template_id":"","subject":"Bem-vindo ao nosso produto!"}},{"id":"2","type":"delay","position":{"x":300,"y":100},"data":{"label":"Esperar 1 dia","duration_days":1}},{"id":"3","type":"task","position":{"x":500,"y":100},"data":{"label":"Verificar acesso criado","task_type":"task","description":"Confirmar que cliente recebeu credenciais"}}],"edges":[{"id":"e1-2","source":"1","target":"2"},{"id":"e2-3","source":"2","target":"3"}]}', true, true),
('Template: Enterprise Premium', 'Onboarding completo com kickoff call e acompanhamento intensivo', '{"nodes":[{"id":"1","type":"email","position":{"x":100,"y":100},"data":{"label":"Email VIP de Boas-vindas","template_id":"","subject":"Bem-vindo - Sua jornada começa aqui"}},{"id":"2","type":"call","position":{"x":300,"y":100},"data":{"label":"Kickoff Call Agendada","task_type":"call","description":"Reunião inicial de 30min para apresentação"}},{"id":"3","type":"delay","position":{"x":500,"y":100},"data":{"label":"Esperar 3 dias","duration_days":3}},{"id":"4","type":"task","position":{"x":700,"y":100},"data":{"label":"Follow-up Implementation","task_type":"meeting","description":"Verificar progresso da implementação"}}],"edges":[{"id":"e1-2","source":"1","target":"2"},{"id":"e2-3","source":"2","target":"3"},{"id":"e3-4","source":"3","target":"4"}]}', true, true),
('Template: Self-Service Rápido', 'Onboarding minimalista para produtos autoexplicativos', '{"nodes":[{"id":"1","type":"email","position":{"x":100,"y":100},"data":{"label":"Email com Tutorial","template_id":"","subject":"Primeiros Passos - Guia Rápido"}},{"id":"2","type":"delay","position":{"x":300,"y":100},"data":{"label":"Esperar 7 dias","duration_days":7}},{"id":"3","type":"email","position":{"x":500,"y":100},"data":{"label":"Email de Check-in","template_id":"","subject":"Como está sua experiência?"}}],"edges":[{"id":"e1-2","source":"1","target":"2"},{"id":"e2-3","source":"2","target":"3"}]}', true, true);