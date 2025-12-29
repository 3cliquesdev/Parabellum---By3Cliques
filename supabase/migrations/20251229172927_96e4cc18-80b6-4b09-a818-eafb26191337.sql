-- Criar sequence iniciando após o último ticket existente (14)
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq_2025 START WITH 15;

-- Substituir função para usar sequence atômica (elimina race condition)
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year TEXT;
  seq_name TEXT;
  next_val INTEGER;
BEGIN
  current_year := to_char(CURRENT_DATE, 'YYYY');
  seq_name := 'ticket_number_seq_' || current_year;
  
  -- Criar sequence do ano se não existir (para anos futuros)
  BEGIN
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START WITH 1', seq_name);
  EXCEPTION WHEN duplicate_table THEN
    NULL;
  END;
  
  -- Obter próximo valor atomicamente
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_val;
  
  NEW.ticket_number := 'TK-' || current_year || '-' || LPAD(next_val::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;