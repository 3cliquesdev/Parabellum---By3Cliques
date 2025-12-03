
-- FASE 2 CONTINUAÇÃO: Corrigir generate_quote_number

-- Dropar e recriar com search_path
DROP FUNCTION IF EXISTS public.generate_quote_number();

CREATE FUNCTION public.generate_quote_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_month TEXT;
  seq INTEGER;
BEGIN
  year_month := TO_CHAR(NOW(), 'YYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 5) AS INTEGER)), 0) + 1
  INTO seq
  FROM quotes
  WHERE quote_number LIKE year_month || '%';
  
  NEW.quote_number := year_month || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- 7. handle_new_user_profile
DROP FUNCTION IF EXISTS public.handle_new_user_profile() CASCADE;

CREATE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Recriar trigger se necessário
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();
