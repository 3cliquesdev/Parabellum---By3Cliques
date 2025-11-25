-- FASE 1: Adicionar campo department na conversations

-- Adicionar coluna department (FK para departments)
ALTER TABLE public.conversations
ADD COLUMN department uuid REFERENCES public.departments(id);

-- Criar index para performance
CREATE INDEX idx_conversations_department ON public.conversations(department);

-- Popular conversas existentes com departamento padrão (primeiro departamento ativo)
UPDATE public.conversations
SET department = (
  SELECT id FROM public.departments 
  WHERE is_active = true 
  ORDER BY created_at ASC 
  LIMIT 1
)
WHERE department IS NULL;

-- Atualizar RLS Policies para considerar department

-- Drop políticas antigas para support_agent em conversations
DROP POLICY IF EXISTS "role_based_select_conversations" ON public.conversations;
DROP POLICY IF EXISTS "role_based_insert_conversations" ON public.conversations;
DROP POLICY IF EXISTS "role_based_update_conversations" ON public.conversations;
DROP POLICY IF EXISTS "role_based_delete_conversations" ON public.conversations;

-- Criar novas políticas com lógica de department

-- SELECT: admin/manager veem tudo, sales_rep vê suas conversas de vendas, support_agent vê conversas de suporte
CREATE POLICY "role_based_select_conversations_with_dept" ON public.conversations
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
  OR (
    has_role(auth.uid(), 'sales_rep'::app_role) 
    AND (
      assigned_to = auth.uid() 
      OR department IN (SELECT id FROM public.departments WHERE name IN ('Comercial', 'Vendas'))
    )
  )
  OR (
    has_role(auth.uid(), 'support_agent'::app_role) 
    AND (
      assigned_to = auth.uid() 
      OR department IN (SELECT id FROM public.departments WHERE name = 'Suporte')
    )
  )
  OR (
    has_role(auth.uid(), 'consultant'::app_role) 
    AND assigned_to = auth.uid()
  )
);

-- INSERT: permite criar conversas no departamento correto
CREATE POLICY "role_based_insert_conversations_with_dept" ON public.conversations
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
  OR (
    has_role(auth.uid(), 'sales_rep'::app_role) 
    AND (assigned_to = auth.uid() OR assigned_to IS NULL)
  )
  OR (
    has_role(auth.uid(), 'support_agent'::app_role) 
    AND (assigned_to = auth.uid() OR assigned_to IS NULL)
  )
  OR (
    has_role(auth.uid(), 'consultant'::app_role) 
    AND (assigned_to = auth.uid() OR assigned_to IS NULL)
  )
);

-- UPDATE: permite atualizar conversas atribuídas ou do departamento correto
CREATE POLICY "role_based_update_conversations_with_dept" ON public.conversations
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
  OR (
    has_role(auth.uid(), 'sales_rep'::app_role) 
    AND assigned_to = auth.uid()
  )
  OR (
    has_role(auth.uid(), 'support_agent'::app_role) 
    AND assigned_to = auth.uid()
  )
  OR (
    has_role(auth.uid(), 'consultant'::app_role) 
    AND assigned_to = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
  OR (
    has_role(auth.uid(), 'sales_rep'::app_role) 
    AND (assigned_to = auth.uid() OR assigned_to IS NULL)
  )
  OR (
    has_role(auth.uid(), 'support_agent'::app_role) 
    AND (assigned_to = auth.uid() OR assigned_to IS NULL)
  )
  OR (
    has_role(auth.uid(), 'consultant'::app_role) 
    AND (assigned_to = auth.uid() OR assigned_to IS NULL)
  )
);

-- DELETE: apenas admin/manager podem deletar
CREATE POLICY "role_based_delete_conversations_with_dept" ON public.conversations
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);