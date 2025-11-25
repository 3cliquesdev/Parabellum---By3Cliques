-- Adicionar 'web_chat' ao enum conversation_channel
ALTER TYPE public.conversation_channel ADD VALUE IF NOT EXISTS 'web_chat';