-- FASE 1: Smart Closing & CSAT Loop - Database Schema

-- Criar tabela conversation_ratings
CREATE TABLE IF NOT EXISTS public.conversation_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  channel conversation_channel NOT NULL,
  feedback_text TEXT,
  sentiment_score TEXT CHECK (sentiment_score IN ('positive', 'neutral', 'negative')),
  ai_analysis TEXT,
  manager_alert_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id)
);

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_conversation_ratings_conversation_id ON public.conversation_ratings(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_ratings_rating ON public.conversation_ratings(rating);
CREATE INDEX IF NOT EXISTS idx_conversation_ratings_manager_alert ON public.conversation_ratings(manager_alert_sent) WHERE manager_alert_sent = false;

-- Adicionar campos de encerramento na tabela conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_closed BOOLEAN DEFAULT false;

-- Criar índice para consultas de conversas fechadas
CREATE INDEX IF NOT EXISTS idx_conversations_closed_at ON public.conversations(closed_at) WHERE status = 'closed';

-- RLS Policies para conversation_ratings

-- Public pode inserir (cliente avalia via web ou WhatsApp)
CREATE POLICY "public_can_insert_ratings"
ON public.conversation_ratings
FOR INSERT
TO public
WITH CHECK (true);

-- Authenticated users podem ver ratings
CREATE POLICY "authenticated_can_view_ratings"
ON public.conversation_ratings
FOR SELECT
TO authenticated
USING (true);

-- Admin/Manager podem atualizar (para marcar manager_alert_sent)
CREATE POLICY "admin_manager_can_update_ratings"
ON public.conversation_ratings
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Habilitar RLS
ALTER TABLE public.conversation_ratings ENABLE ROW LEVEL SECURITY;