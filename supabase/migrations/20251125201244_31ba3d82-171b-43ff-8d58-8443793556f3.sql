-- FASE 1: Storage Bucket e RLS Policies para Playbook Assets

-- Criar bucket para assets de playbook (imagens, PDFs, arquivos)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('playbook-assets', 'playbook-assets', true);

-- RLS: Admin/Manager podem fazer upload
CREATE POLICY "Admin/Manager upload playbook assets"
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'playbook-assets' 
  AND auth.role() = 'authenticated'
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

-- RLS: Admin/Manager podem deletar
CREATE POLICY "Admin/Manager delete playbook assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'playbook-assets'
  AND auth.role() = 'authenticated'
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

-- RLS: Todos podem visualizar (cliente vê conteúdo)
CREATE POLICY "Public read playbook assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'playbook-assets');