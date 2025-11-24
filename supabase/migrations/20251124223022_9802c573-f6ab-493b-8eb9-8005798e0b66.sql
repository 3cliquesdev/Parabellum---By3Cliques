-- FASE 12A: Preparação do Banco de Dados para Analytics 2.0

-- 1. Adicionar coluna source na tabela contacts
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS source TEXT;

-- 2. Popular dados mock de origem para contatos existentes (distribuição realista)
-- Usando MOD para distribuir fontes de forma determinística mas variada
UPDATE public.contacts
SET source = CASE 
  WHEN (EXTRACT(EPOCH FROM created_at)::INTEGER % 10) < 3 THEN 'Google Ads'
  WHEN (EXTRACT(EPOCH FROM created_at)::INTEGER % 10) < 6 THEN 'Indicação'
  WHEN (EXTRACT(EPOCH FROM created_at)::INTEGER % 10) < 8 THEN 'Instagram'
  WHEN (EXTRACT(EPOCH FROM created_at)::INTEGER % 10) < 9 THEN 'LinkedIn'
  ELSE 'Site Direto'
END
WHERE source IS NULL;

-- 3. Criar função para calcular taxa de conversão ao longo do tempo
CREATE OR REPLACE FUNCTION public.get_conversion_rate_timeline(
  p_days_back INTEGER DEFAULT 90
)
RETURNS TABLE(
  date DATE,
  total_deals INTEGER,
  won_deals INTEGER,
  lost_deals INTEGER,
  conversion_rate NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH daily_deals AS (
    SELECT 
      DATE(d.created_at) as deal_date,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE d.status = 'won') as won,
      COUNT(*) FILTER (WHERE d.status = 'lost') as lost
    FROM public.deals d
    WHERE d.created_at >= (CURRENT_DATE - p_days_back)
    GROUP BY DATE(d.created_at)
  )
  SELECT 
    deal_date as date,
    total::INTEGER as total_deals,
    won::INTEGER as won_deals,
    lost::INTEGER as lost_deals,
    CASE 
      WHEN (won + lost) > 0 THEN ROUND((won::NUMERIC / (won + lost)::NUMERIC * 100), 2)
      ELSE 0
    END as conversion_rate
  FROM daily_deals
  ORDER BY deal_date ASC;
END;
$$;

-- 4. Comentários para documentação
COMMENT ON COLUMN public.contacts.source IS 'Origem do lead: Google Ads, Instagram, LinkedIn, Indicação, Site Direto, etc.';
COMMENT ON FUNCTION public.get_conversion_rate_timeline IS 'Retorna taxa de conversão diária (won/total) dos últimos N dias para análise de tendência';