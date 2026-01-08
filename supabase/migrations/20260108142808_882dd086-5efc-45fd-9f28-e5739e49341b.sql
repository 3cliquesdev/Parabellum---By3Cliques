-- Add manual_offline to profiles (indicates agent clicked offline button manually)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS manual_offline BOOLEAN DEFAULT false;

-- Add awaiting_rating to conversations (indicates we're waiting for a CSAT response)
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS awaiting_rating BOOLEAN DEFAULT false;

-- Add rating_sent_at to track when CSAT was sent
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS rating_sent_at TIMESTAMP WITH TIME ZONE;