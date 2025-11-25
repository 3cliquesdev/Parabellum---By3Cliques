-- Fix handle_new_user_profile trigger to include department field
-- This fixes the "null value in column department" error when creating users

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_department_id UUID;
BEGIN
  -- Get department_id from user_metadata, or get the first active department as fallback
  v_department_id := (NEW.raw_user_meta_data->>'department')::UUID;
  
  IF v_department_id IS NULL THEN
    -- Fallback: get first active department
    SELECT id INTO v_department_id
    FROM public.departments
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  
  -- If still no department found, raise error
  IF v_department_id IS NULL THEN
    RAISE EXCEPTION 'Cannot create profile: no department available';
  END IF;
  
  INSERT INTO public.profiles (id, full_name, job_title, department)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário Sem Nome'),
    COALESCE(NEW.raw_user_meta_data->>'job_title', 'Vendedor'),
    v_department_id
  );
  
  RETURN NEW;
END;
$function$;