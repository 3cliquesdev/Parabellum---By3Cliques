-- FASE 1: Database Schema Refactoring para AI Híbrida (Autopilot/Copilot/Disabled)

-- 1A. Criar ENUM ai_mode
CREATE TYPE ai_mode AS ENUM ('autopilot', 'copilot', 'disabled');

-- 1B. Adicionar coluna ai_mode na tabela conversations
ALTER TABLE public.conversations 
ADD COLUMN ai_mode ai_mode NOT NULL DEFAULT 'autopilot';

-- Criar índice para melhor performance nas queries por modo
CREATE INDEX idx_conversations_ai_mode ON public.conversations(ai_mode);

-- 1C. Criar tabela ai_suggestions (para modo Copilot - Smart Replies)
CREATE TABLE public.ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  suggested_reply TEXT NOT NULL,
  context JSONB, -- última mensagem do cliente, sentiment, metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used BOOLEAN NOT NULL DEFAULT FALSE
);

-- Índices para performance
CREATE INDEX idx_ai_suggestions_conversation_id ON public.ai_suggestions(conversation_id);
CREATE INDEX idx_ai_suggestions_created_at ON public.ai_suggestions(created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies para ai_suggestions
-- Admin/Manager podem ver todas as sugestões
CREATE POLICY "role_based_select_ai_suggestions" 
ON public.ai_suggestions 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role) 
  OR (
    has_role(auth.uid(), 'sales_rep'::app_role) 
    AND EXISTS (
      SELECT 1 
      FROM public.conversations c 
      WHERE c.id = ai_suggestions.conversation_id 
        AND c.assigned_to = auth.uid()
    )
  )
);

-- Apenas sistema (Edge Functions) pode inserir sugestões
CREATE POLICY "authenticated_can_insert_ai_suggestions" 
ON public.ai_suggestions 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Admin/Manager e atendente atribuído podem marcar como usado
CREATE POLICY "role_based_update_ai_suggestions" 
ON public.ai_suggestions 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role) 
  OR (
    has_role(auth.uid(), 'sales_rep'::app_role) 
    AND EXISTS (
      SELECT 1 
      FROM public.conversations c 
      WHERE c.id = ai_suggestions.conversation_id 
        AND c.assigned_to = auth.uid()
    )
  )
);

-- Admin/Manager podem deletar sugestões
CREATE POLICY "role_based_delete_ai_suggestions" 
ON public.ai_suggestions 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);