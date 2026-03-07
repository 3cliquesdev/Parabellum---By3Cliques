INSERT INTO public.tags (name, color)
VALUES ('pendente_retorno', '#F59E0B')
ON CONFLICT (name) DO NOTHING;