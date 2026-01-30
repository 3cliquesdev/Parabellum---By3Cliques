-- Tabela para jobs de broadcast assíncrono
CREATE TABLE public.broadcast_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Configuração
  message TEXT NOT NULL,
  target_filter JSONB DEFAULT '{}',
  
  -- Progresso
  status TEXT NOT NULL DEFAULT 'pending',
  total INT NOT NULL DEFAULT 0,
  sent INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  skipped INT NOT NULL DEFAULT 0,
  
  -- Resultados detalhados (array de objetos)
  results JSONB DEFAULT '[]',
  
  -- Controle de tempo
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Constraint para status válido
  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'cancelled', 'failed'))
);

-- Índices para performance
CREATE INDEX idx_broadcast_jobs_status ON public.broadcast_jobs(status);
CREATE INDEX idx_broadcast_jobs_created_by ON public.broadcast_jobs(created_by);
CREATE INDEX idx_broadcast_jobs_created_at ON public.broadcast_jobs(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.broadcast_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Managers podem criar broadcasts
CREATE POLICY "Managers can create broadcasts" ON public.broadcast_jobs
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager', 'general_manager')
    )
  );

-- Policy: Managers podem ver broadcasts
CREATE POLICY "Managers can view broadcasts" ON public.broadcast_jobs
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager', 'general_manager')
    )
  );

-- Policy: Managers podem atualizar (cancelar) broadcasts
CREATE POLICY "Managers can update broadcasts" ON public.broadcast_jobs
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager', 'general_manager')
    )
  );

-- Policy: Service role pode fazer tudo (para edge functions)
CREATE POLICY "Service role full access" ON public.broadcast_jobs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Habilitar Realtime para progresso em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_jobs;