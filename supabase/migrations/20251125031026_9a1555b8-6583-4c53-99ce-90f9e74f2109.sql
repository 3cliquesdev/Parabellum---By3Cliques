-- =====================================================
-- FASE 1: AI Studio - Schema Foundation
-- =====================================================

-- Tabela de Personas (múltiplos perfis de IA)
CREATE TABLE public.ai_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('sales', 'support', 'onboarding', 'custom')),
  system_prompt TEXT NOT NULL,
  temperature DECIMAL(2,1) DEFAULT 0.7 CHECK (temperature >= 0.0 AND temperature <= 1.0),
  max_tokens INTEGER DEFAULT 500 CHECK (max_tokens >= 100 AND max_tokens <= 2000),
  knowledge_base_paths TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de AI Tools disponíveis (function calling)
CREATE TABLE public.ai_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  function_schema JSONB NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  requires_auth BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Relacionamento N:N entre Personas e Tools
CREATE TABLE public.ai_persona_tools (
  persona_id UUID REFERENCES public.ai_personas(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES public.ai_tools(id) ON DELETE CASCADE,
  PRIMARY KEY (persona_id, tool_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de roteamento (qual persona atende qual canal)
CREATE TABLE public.ai_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'chat', 'form')),
  department department_type,
  persona_id UUID REFERENCES public.ai_personas(id) ON DELETE SET NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- Triggers para updated_at
-- =====================================================

CREATE TRIGGER update_ai_personas_updated_at
BEFORE UPDATE ON public.ai_personas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_routing_rules_updated_at
BEFORE UPDATE ON public.ai_routing_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Row Level Security Policies
-- =====================================================

-- ai_personas policies
ALTER TABLE public.ai_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_managers_can_manage_personas"
ON public.ai_personas
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "sales_rep_can_view_personas"
ON public.ai_personas
FOR SELECT
TO authenticated
USING (true);

-- ai_tools policies
ALTER TABLE public.ai_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_managers_can_manage_tools"
ON public.ai_tools
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "sales_rep_can_view_tools"
ON public.ai_tools
FOR SELECT
TO authenticated
USING (true);

-- ai_persona_tools policies
ALTER TABLE public.ai_persona_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_managers_can_manage_persona_tools"
ON public.ai_persona_tools
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "sales_rep_can_view_persona_tools"
ON public.ai_persona_tools
FOR SELECT
TO authenticated
USING (true);

-- ai_routing_rules policies
ALTER TABLE public.ai_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_managers_can_manage_routing"
ON public.ai_routing_rules
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "sales_rep_can_view_routing"
ON public.ai_routing_rules
FOR SELECT
TO authenticated
USING (true);

-- =====================================================
-- Seed Data: 2 Personas (Hunter & Helper)
-- =====================================================

INSERT INTO public.ai_personas (name, role, system_prompt, temperature, max_tokens, knowledge_base_paths, is_active) VALUES
(
  'Hunter - Agente de Vendas',
  'sales',
  'Você é Hunter, um especialista em vendas consultivo e persuasivo. Seu objetivo é qualificar leads e agendar demonstrações.

PERSONALIDADE: Confiante, objetivo, usa gatilhos mentais de escassez e autoridade. Seja educado mas direto ao ponto.

ESTRATÉGIA:
1. Identifique a DOR do cliente com perguntas abertas
2. Conecte a dor com a solução que oferecemos
3. Use prova social ("Empresas como X já conseguiram Y")
4. Crie urgência ("Temos apenas 3 vagas este mês")
5. SEMPRE termine com call-to-action claro: "Posso agendar 15min na sua agenda?"

RESTRIÇÕES:
- NUNCA dê descontos sem aprovação
- NUNCA prometa features que não existem
- Se perguntarem preço, diga "Depende do caso de uso. Vamos agendar 15min?"
- Máximo 3 mensagens antes de pedir a demo

TOM: Profissional, entusiasta, focado em resultados.',
  0.8,
  400,
  ARRAY['precos', 'casos-sucesso', 'comparativos'],
  true
),
(
  'Helper - Agente de Suporte',
  'support',
  'Você é Helper, um especialista técnico empático e paciente. Seu objetivo é resolver problemas e educar clientes.

PERSONALIDADE: Calmo, detalhista, pedagógico. Faça o cliente se sentir ouvido e compreendido.

ESTRATÉGIA:
1. Valide o sentimento ("Entendo sua frustração, vamos resolver juntos")
2. Peça DETALHES específicos: prints, mensagens de erro, passos reproduzir
3. Ofereça soluções passo-a-passo numeradas
4. Confirme se resolveu ("Isso resolveu seu problema?")
5. Se não souber, seja honesto: "Vou consultar um especialista e retorno em X minutos"

QUANDO ESCALAR:
- Cliente menciona "cancelar conta" ou "reembolso" → Transferir para humano
- Problema técnico complexo que exige acesso ao banco → Criar ticket
- Cliente irritado/frustrado por mais de 3 mensagens → Transferir para humano

TOM: Empático, técnico mas acessível, sempre positivo.',
  0.7,
  600,
  ARRAY['manuais-tecnicos', 'faq', 'troubleshooting'],
  true
);

-- =====================================================
-- Seed Data: 4 AI Tools (Function Calling)
-- =====================================================

INSERT INTO public.ai_tools (name, description, function_schema, is_enabled, requires_auth) VALUES
(
  'check_order_status',
  'Consulta o status de um pedido ou negócio no sistema. Retorna informações sobre estágio atual, valor e previsão de fechamento.',
  '{
    "name": "check_order_status",
    "description": "Consulta informações de um pedido/deal pelo ID ou email do cliente",
    "parameters": {
      "type": "object",
      "properties": {
        "customer_email": {
          "type": "string",
          "description": "Email do cliente para buscar seus pedidos"
        },
        "deal_id": {
          "type": "string",
          "description": "ID específico do negócio (opcional)"
        }
      },
      "required": ["customer_email"]
    }
  }'::jsonb,
  true,
  true
),
(
  'create_ticket',
  'Cria um novo ticket de suporte no sistema quando o cliente relata um problema que requer acompanhamento.',
  '{
    "name": "create_ticket",
    "description": "Cria um ticket de suporte com informações do problema relatado",
    "parameters": {
      "type": "object",
      "properties": {
        "subject": {
          "type": "string",
          "description": "Título/assunto do ticket"
        },
        "description": {
          "type": "string",
          "description": "Descrição detalhada do problema"
        },
        "priority": {
          "type": "string",
          "enum": ["low", "medium", "high", "urgent"],
          "description": "Prioridade do ticket baseada na urgência"
        },
        "category": {
          "type": "string",
          "enum": ["financeiro", "tecnico", "bug", "outro"],
          "description": "Categoria do problema"
        }
      },
      "required": ["subject", "description", "priority", "category"]
    }
  }'::jsonb,
  true,
  true
),
(
  'schedule_meeting',
  'Consulta agenda disponível e marca reuniões com clientes. (Placeholder para integração futura com calendário)',
  '{
    "name": "schedule_meeting",
    "description": "Agenda uma reunião/demo com o cliente",
    "parameters": {
      "type": "object",
      "properties": {
        "customer_email": {
          "type": "string",
          "description": "Email do cliente"
        },
        "duration_minutes": {
          "type": "integer",
          "enum": [15, 30, 60],
          "description": "Duração da reunião em minutos"
        },
        "preferred_date": {
          "type": "string",
          "description": "Data preferida no formato YYYY-MM-DD"
        },
        "meeting_type": {
          "type": "string",
          "enum": ["demo", "onboarding", "support", "comercial"],
          "description": "Tipo de reunião"
        }
      },
      "required": ["customer_email", "duration_minutes", "meeting_type"]
    }
  }'::jsonb,
  false,
  true
),
(
  'search_knowledge_base',
  'Busca em documentação e base de conhecimento para responder dúvidas técnicas ou comerciais.',
  '{
    "name": "search_knowledge_base",
    "description": "Busca documentos relevantes na base de conhecimento",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Termo ou pergunta para buscar"
        },
        "category": {
          "type": "string",
          "enum": ["tecnico", "comercial", "financeiro", "produto"],
          "description": "Categoria da documentação"
        },
        "max_results": {
          "type": "integer",
          "default": 3,
          "description": "Número máximo de documentos para retornar"
        }
      },
      "required": ["query"]
    }
  }'::jsonb,
  false,
  false
);

-- =====================================================
-- Seed Data: Routing Rules (Roteamento Padrão)
-- =====================================================

-- Buscar IDs das personas criadas
DO $$
DECLARE
  hunter_id UUID;
  helper_id UUID;
BEGIN
  SELECT id INTO hunter_id FROM public.ai_personas WHERE role = 'sales' LIMIT 1;
  SELECT id INTO helper_id FROM public.ai_personas WHERE role = 'support' LIMIT 1;

  -- Regras de roteamento padrão
  INSERT INTO public.ai_routing_rules (channel, department, persona_id, priority, is_active) VALUES
  ('whatsapp', 'comercial', hunter_id, 10, true),
  ('email', 'comercial', hunter_id, 10, true),
  ('chat', 'comercial', hunter_id, 10, true),
  ('whatsapp', 'suporte', helper_id, 10, true),
  ('email', 'suporte', helper_id, 10, true),
  ('chat', 'suporte', helper_id, 10, true),
  ('form', NULL, hunter_id, 5, true); -- Formulários vão para Hunter por padrão
END $$;