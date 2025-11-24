-- ========================================
-- FASE 1: CRIAR ENUMs
-- ========================================

-- ENUM para status de customer
CREATE TYPE public.customer_status AS ENUM (
  'lead',
  'qualified',
  'customer',
  'inactive',
  'churned'
);

-- ENUM para tipos de interação
CREATE TYPE public.interaction_type AS ENUM (
  'email_sent',
  'email_open',
  'email_click',
  'call_incoming',
  'call_outgoing',
  'whatsapp_msg',
  'whatsapp_reply',
  'deal_created',
  'deal_won',
  'deal_lost',
  'note',
  'status_change',
  'meeting',
  'form_submission'
);

-- ENUM para canais de comunicação
CREATE TYPE public.communication_channel AS ENUM (
  'email',
  'phone',
  'whatsapp',
  'chat',
  'meeting',
  'form',
  'other'
);

-- ========================================
-- FASE 2: MODIFICAR TABELAS EXISTENTES
-- ========================================

-- Expandir tabela contacts (customers)
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS company TEXT,
ADD COLUMN IF NOT EXISTS status customer_status DEFAULT 'lead',
ADD COLUMN IF NOT EXISTS total_ltv NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Criar constraint UNIQUE no email (deduplicação)
ALTER TABLE public.contacts
DROP CONSTRAINT IF EXISTS contacts_email_unique;

ALTER TABLE public.contacts
ADD CONSTRAINT contacts_email_unique UNIQUE (email);

-- Criar índices para performance em contacts
CREATE INDEX IF NOT EXISTS idx_contacts_status ON public.contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_last_contact ON public.contacts(last_contact_date DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_ltv ON public.contacts(total_ltv DESC);

-- Comentários em contacts
COMMENT ON COLUMN public.contacts.company IS 'Nome livre da empresa (alternativa ao organization_id)';
COMMENT ON COLUMN public.contacts.status IS 'Status atual do cliente no funil';
COMMENT ON COLUMN public.contacts.total_ltv IS 'Lifetime Value: soma de todos os deals ganhos';
COMMENT ON COLUMN public.contacts.last_contact_date IS 'Data da última interação (atualizada automaticamente)';

-- Expandir tabela deals
ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS probability INTEGER DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- Criar índices em deals
CREATE INDEX IF NOT EXISTS idx_deals_probability ON public.deals(probability);
CREATE INDEX IF NOT EXISTS idx_deals_closed_at ON public.deals(closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_status ON public.deals(status);

-- Comentários em deals
COMMENT ON COLUMN public.deals.probability IS 'Probabilidade de fechar o negócio (0-100%)';
COMMENT ON COLUMN public.deals.closed_at IS 'Data/hora de fechamento (won ou lost)';

-- ========================================
-- FASE 3: CRIAR NOVAS TABELAS
-- ========================================

-- Tabela interactions (Linha do Tempo)
CREATE TABLE IF NOT EXISTS public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  type interaction_type NOT NULL,
  content TEXT NOT NULL,
  channel communication_channel NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para performance em interactions
CREATE INDEX IF NOT EXISTS idx_interactions_customer ON public.interactions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON public.interactions(type);
CREATE INDEX IF NOT EXISTS idx_interactions_channel ON public.interactions(channel);
CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON public.interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_metadata ON public.interactions USING GIN (metadata);

-- RLS Policy para interactions
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view interactions" ON public.interactions;
CREATE POLICY "Authenticated users can view interactions"
  ON public.interactions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create interactions" ON public.interactions;
CREATE POLICY "Authenticated users can create interactions"
  ON public.interactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update interactions" ON public.interactions;
CREATE POLICY "Authenticated users can update interactions"
  ON public.interactions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete interactions" ON public.interactions;
CREATE POLICY "Authenticated users can delete interactions"
  ON public.interactions FOR DELETE
  TO authenticated
  USING (true);

-- Comentários em interactions
COMMENT ON TABLE public.interactions IS 'Linha do tempo completa de todas as interações com clientes';
COMMENT ON COLUMN public.interactions.metadata IS 'Dados extras: {email_id, call_duration, whatsapp_message_id, etc}';

-- Tabela tags (Etiquetas/Segmentos)
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3B82F6',
  category TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices em tags
CREATE INDEX IF NOT EXISTS idx_tags_name ON public.tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_category ON public.tags(category);

-- RLS Policy para tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage tags" ON public.tags;
CREATE POLICY "Authenticated users can manage tags"
  ON public.tags FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comentários em tags
COMMENT ON TABLE public.tags IS 'Sistema de tags para segmentação avançada de clientes';
COMMENT ON COLUMN public.tags.color IS 'Cor hexadecimal para visualização (#RRGGBB)';
COMMENT ON COLUMN public.tags.category IS 'Categoria da tag (ex: "segmento", "interesse", "fonte")';

-- Tabela customer_tags (Relação N:N)
CREATE TABLE IF NOT EXISTS public.customer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(customer_id, tag_id)
);

-- Índices em customer_tags
CREATE INDEX IF NOT EXISTS idx_customer_tags_customer ON public.customer_tags(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_tag ON public.customer_tags(tag_id);

-- RLS Policy para customer_tags
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage customer tags" ON public.customer_tags;
CREATE POLICY "Authenticated users can manage customer tags"
  ON public.customer_tags FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comentários em customer_tags
COMMENT ON TABLE public.customer_tags IS 'Relação muitos-para-muitos entre clientes e tags';

-- ========================================
-- FASE 4: CRIAR TRIGGERS E AUTOMAÇÕES
-- ========================================

-- Function para calcular LTV automaticamente
CREATE OR REPLACE FUNCTION public.calculate_customer_ltv()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recalcular o LTV total do customer quando um deal for ganho ou atualizado
  IF NEW.status = 'won' THEN
    UPDATE public.contacts
    SET total_ltv = COALESCE(
      (SELECT SUM(value) 
       FROM public.deals 
       WHERE contact_id = NEW.contact_id 
         AND status = 'won'),
      0
    )
    WHERE id = NEW.contact_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger no INSERT/UPDATE de deals
DROP TRIGGER IF EXISTS trigger_calculate_ltv ON public.deals;
CREATE TRIGGER trigger_calculate_ltv
AFTER INSERT OR UPDATE OF status, value ON public.deals
FOR EACH ROW
WHEN (NEW.contact_id IS NOT NULL)
EXECUTE FUNCTION public.calculate_customer_ltv();

-- Function para registrar interações automaticamente
CREATE OR REPLACE FUNCTION public.auto_register_interaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Registrar criação de deal como interação
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.interactions (customer_id, type, content, channel, metadata)
    VALUES (
      NEW.contact_id,
      'deal_created',
      'Novo negócio criado: ' || NEW.title,
      'other',
      jsonb_build_object(
        'deal_id', NEW.id,
        'value', NEW.value,
        'currency', NEW.currency
      )
    );
  -- Registrar fechamento de deal
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'won' THEN
      INSERT INTO public.interactions (customer_id, type, content, channel, metadata)
      VALUES (
        NEW.contact_id,
        'deal_won',
        'Negócio ganho: ' || NEW.title,
        'other',
        jsonb_build_object(
          'deal_id', NEW.id,
          'value', NEW.value,
          'currency', NEW.currency
        )
      );
    ELSIF NEW.status = 'lost' THEN
      INSERT INTO public.interactions (customer_id, type, content, channel, metadata)
      VALUES (
        NEW.contact_id,
        'deal_lost',
        'Negócio perdido: ' || NEW.title,
        'other',
        jsonb_build_object('deal_id', NEW.id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para registrar eventos de deals
DROP TRIGGER IF EXISTS trigger_auto_register_deal_interaction ON public.deals;
CREATE TRIGGER trigger_auto_register_deal_interaction
AFTER INSERT OR UPDATE OF status ON public.deals
FOR EACH ROW
WHEN (NEW.contact_id IS NOT NULL)
EXECUTE FUNCTION public.auto_register_interaction();

-- Function para atualizar last_contact_date
CREATE OR REPLACE FUNCTION public.update_last_contact_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar a última data de contato do customer
  UPDATE public.contacts
  SET last_contact_date = NOW()
  WHERE id = NEW.customer_id;
  
  RETURN NEW;
END;
$$;

-- Trigger em interactions
DROP TRIGGER IF EXISTS trigger_update_last_contact ON public.interactions;
CREATE TRIGGER trigger_update_last_contact
AFTER INSERT ON public.interactions
FOR EACH ROW
EXECUTE FUNCTION public.update_last_contact_date();

-- Function para atualizar closed_at em deals
CREATE OR REPLACE FUNCTION public.update_deal_closed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Registrar data de fechamento quando status mudar para won ou lost
  IF NEW.status IN ('won', 'lost') AND (OLD.status IS NULL OR OLD.status NOT IN ('won', 'lost')) THEN
    NEW.closed_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para deals
DROP TRIGGER IF EXISTS trigger_set_closed_at ON public.deals;
CREATE TRIGGER trigger_set_closed_at
BEFORE UPDATE OF status ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.update_deal_closed_at();

-- ========================================
-- FASE 5: INSERIR DADOS INICIAIS (TAGS)
-- ========================================

-- Tags de Segmento
INSERT INTO public.tags (name, color, category, description) VALUES
  ('VIP', '#8B5CF6', 'segmento', 'Clientes VIP com alto LTV'),
  ('Enterprise', '#EF4444', 'segmento', 'Grandes empresas'),
  ('SMB', '#10B981', 'segmento', 'Pequenas e médias empresas'),
  ('Startup', '#F59E0B', 'segmento', 'Startups e empresas em fase inicial')
ON CONFLICT (name) DO NOTHING;

-- Tags de Fonte
INSERT INTO public.tags (name, color, category, description) VALUES
  ('Indicação', '#3B82F6', 'fonte', 'Veio por indicação'),
  ('Google Ads', '#06B6D4', 'fonte', 'Origem: campanhas Google Ads'),
  ('Redes Sociais', '#EC4899', 'fonte', 'Origem: redes sociais'),
  ('Site', '#14B8A6', 'fonte', 'Veio pelo site/formulário')
ON CONFLICT (name) DO NOTHING;

-- Tags de Interesse
INSERT INTO public.tags (name, color, category, description) VALUES
  ('Consultoria', '#6366F1', 'interesse', 'Interessado em consultoria'),
  ('Implementação', '#8B5CF6', 'interesse', 'Interessado em implementação'),
  ('Suporte', '#A855F7', 'interesse', 'Interessado em suporte técnico')
ON CONFLICT (name) DO NOTHING;