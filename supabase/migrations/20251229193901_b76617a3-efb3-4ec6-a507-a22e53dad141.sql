-- Criar tabela de políticas de SLA
CREATE TABLE public.sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.ticket_categories(id) ON DELETE CASCADE,
  priority TEXT DEFAULT NULL, -- NULL significa "todas as prioridades"
  
  -- Tempo de primeira resposta
  response_time_value INTEGER NOT NULL DEFAULT 1,
  response_time_unit TEXT NOT NULL DEFAULT 'hours' CHECK (response_time_unit IN ('hours', 'business_hours', 'business_days')),
  
  -- Tempo de resolução
  resolution_time_value INTEGER NOT NULL DEFAULT 24,
  resolution_time_unit TEXT NOT NULL DEFAULT 'hours' CHECK (resolution_time_unit IN ('hours', 'business_hours', 'business_days')),
  
  -- Configurações
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(category_id, priority)
);

-- Criar tabela de feriados
CREATE TABLE public.business_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(date, is_recurring)
);

-- Criar tabela de configuração de horário comercial
CREATE TABLE public.business_hours_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Dom, 6=Sab
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  is_working_day BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(day_of_week)
);

-- Inserir configuração padrão de horário comercial (Seg-Sex 9h-18h)
INSERT INTO public.business_hours_config (day_of_week, start_time, end_time, is_working_day) VALUES
  (0, '09:00', '18:00', false), -- Domingo
  (1, '09:00', '18:00', true),  -- Segunda
  (2, '09:00', '18:00', true),  -- Terça
  (3, '09:00', '18:00', true),  -- Quarta
  (4, '09:00', '18:00', true),  -- Quinta
  (5, '09:00', '18:00', true),  -- Sexta
  (6, '09:00', '18:00', false); -- Sábado

-- Inserir feriados nacionais brasileiros (recorrentes)
INSERT INTO public.business_holidays (date, description, is_recurring) VALUES
  ('2025-01-01', 'Confraternização Universal', true),
  ('2025-04-21', 'Tiradentes', true),
  ('2025-05-01', 'Dia do Trabalho', true),
  ('2025-09-07', 'Independência do Brasil', true),
  ('2025-10-12', 'Nossa Senhora Aparecida', true),
  ('2025-11-02', 'Finados', true),
  ('2025-11-15', 'Proclamação da República', true),
  ('2025-12-25', 'Natal', true);

-- Função para calcular data de vencimento considerando dias úteis
CREATE OR REPLACE FUNCTION public.calculate_business_due_date(
  p_start_date TIMESTAMPTZ,
  p_time_value INTEGER,
  p_time_unit TEXT
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result_date TIMESTAMPTZ;
  v_current_date DATE;
  v_days_added INTEGER := 0;
  v_end_time TIME;
  v_is_working_day BOOLEAN;
BEGIN
  -- Se for horas simples, soma diretamente
  IF p_time_unit = 'hours' THEN
    RETURN p_start_date + (p_time_value || ' hours')::INTERVAL;
  END IF;
  
  -- Se for horas úteis (considera 8 horas por dia útil)
  IF p_time_unit = 'business_hours' THEN
    -- Converter para dias úteis (arredondando para cima)
    RETURN public.calculate_business_due_date(
      p_start_date, 
      CEIL(p_time_value::NUMERIC / 8)::INTEGER, 
      'business_days'
    );
  END IF;
  
  -- Se for dias úteis
  IF p_time_unit = 'business_days' THEN
    v_current_date := p_start_date::DATE;
    
    WHILE v_days_added < p_time_value LOOP
      v_current_date := v_current_date + 1;
      
      -- Verificar se é dia útil (usando config)
      SELECT is_working_day INTO v_is_working_day
      FROM public.business_hours_config
      WHERE day_of_week = EXTRACT(DOW FROM v_current_date);
      
      IF v_is_working_day IS NULL THEN
        v_is_working_day := EXTRACT(DOW FROM v_current_date) NOT IN (0, 6);
      END IF;
      
      -- Se não for dia útil, pular
      IF NOT v_is_working_day THEN
        CONTINUE;
      END IF;
      
      -- Verificar se é feriado
      IF EXISTS (
        SELECT 1 FROM public.business_holidays 
        WHERE (
          (is_recurring = false AND date = v_current_date)
          OR (is_recurring = true 
              AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM v_current_date) 
              AND EXTRACT(DAY FROM date) = EXTRACT(DAY FROM v_current_date))
        )
      ) THEN
        CONTINUE;
      END IF;
      
      -- É dia útil, incrementar contador
      v_days_added := v_days_added + 1;
    END LOOP;
    
    -- Pegar horário de fim do expediente
    SELECT end_time INTO v_end_time
    FROM public.business_hours_config
    WHERE day_of_week = EXTRACT(DOW FROM v_current_date);
    
    IF v_end_time IS NULL THEN
      v_end_time := '18:00'::TIME;
    END IF;
    
    RETURN v_current_date + v_end_time;
  END IF;
  
  -- Fallback: soma horas simples
  RETURN p_start_date + (p_time_value || ' hours')::INTERVAL;
END;
$$;

-- Enable RLS
ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours_config ENABLE ROW LEVEL SECURITY;

-- Policies para leitura (todos autenticados podem ler)
CREATE POLICY "Authenticated users can read sla_policies"
  ON public.sla_policies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read business_holidays"
  ON public.business_holidays FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read business_hours_config"
  ON public.business_hours_config FOR SELECT
  TO authenticated
  USING (true);

-- Policies para escrita (apenas admins/managers)
CREATE POLICY "Admins can manage sla_policies"
  ON public.sla_policies FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can manage business_holidays"
  ON public.business_holidays FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can manage business_hours_config"
  ON public.business_hours_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );