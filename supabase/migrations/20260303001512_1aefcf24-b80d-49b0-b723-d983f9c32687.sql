
-- Limpeza granular: setar consultant_id = NULL para IDs que NÃO são consultores
-- Executado por ID explícito para evitar limitações de subquery
UPDATE public.contacts SET consultant_id = NULL WHERE consultant_id = 'c190047a-9005-45e3-81d1-0814ca6727b0';
UPDATE public.contacts SET consultant_id = NULL WHERE consultant_id = '522d898d-347b-495e-b4e6-23759c21b07f';
UPDATE public.contacts SET consultant_id = NULL WHERE consultant_id = '6e8c3566-8489-4ba4-9f8d-52aa42af430b';
UPDATE public.contacts SET consultant_id = NULL WHERE consultant_id = 'dfc475f0-014b-45e4-9fdf-4ad879ffdc9a';
UPDATE public.contacts SET consultant_id = NULL WHERE consultant_id = 'de03d434-9e8c-466b-b7a8-9a08bbef1760';
UPDATE public.contacts SET consultant_id = NULL WHERE consultant_id = '697a5d4e-9637-4b85-b7a0-bd880151648b';
