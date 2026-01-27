-- Adicionar campo is_master_flow em chat_flows
-- Permite definir um fluxo como "guia mestre" para a IA seguir em atendimentos
ALTER TABLE public.chat_flows
ADD COLUMN IF NOT EXISTS is_master_flow boolean DEFAULT false;

-- Comentário para documentação
COMMENT ON COLUMN public.chat_flows.is_master_flow IS 'Define se este fluxo é o fluxo mestre que a IA usa como base para atendimentos';

-- Apenas um fluxo pode ser mestre por vez (trigger para garantir)
CREATE OR REPLACE FUNCTION ensure_single_master_flow()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_master_flow = true THEN
    -- Desativar outros fluxos mestres
    UPDATE public.chat_flows 
    SET is_master_flow = false 
    WHERE id != NEW.id AND is_master_flow = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_single_master_flow ON public.chat_flows;
CREATE TRIGGER trg_ensure_single_master_flow
  BEFORE INSERT OR UPDATE OF is_master_flow ON public.chat_flows
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_master_flow();

-- Adicionar default_persona_id em profiles
-- Permite vincular uma persona padrão a cada agente humano
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS default_persona_id uuid REFERENCES public.ai_personas(id) ON DELETE SET NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.profiles.default_persona_id IS 'Persona de IA padrão usada quando este agente está em modo copilot';

-- Índice para busca rápida de fluxo mestre ativo
CREATE INDEX IF NOT EXISTS idx_chat_flows_master_flow 
ON public.chat_flows(is_master_flow) 
WHERE is_master_flow = true AND is_active = true;