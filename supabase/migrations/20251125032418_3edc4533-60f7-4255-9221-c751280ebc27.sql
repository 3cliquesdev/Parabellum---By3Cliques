-- Create RLHF Feedback table
CREATE TABLE IF NOT EXISTS public.rlhf_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES public.ai_personas(id) ON DELETE CASCADE,
  message_content TEXT NOT NULL,
  user_message TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative')),
  feedback_comment TEXT,
  tool_calls JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_rlhf_feedback_persona_id ON public.rlhf_feedback(persona_id);
CREATE INDEX IF NOT EXISTS idx_rlhf_feedback_created_at ON public.rlhf_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rlhf_feedback_type ON public.rlhf_feedback(feedback_type);

-- Enable RLS
ALTER TABLE public.rlhf_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "admins_managers_can_view_all_feedback"
  ON public.rlhf_feedback
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "authenticated_can_create_feedback"
  ON public.rlhf_feedback
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "users_can_view_own_feedback"
  ON public.rlhf_feedback
  FOR SELECT
  USING (created_by = auth.uid());

COMMENT ON TABLE public.rlhf_feedback IS 'Stores human feedback (RLHF) on AI persona responses for quality improvement';
COMMENT ON COLUMN public.rlhf_feedback.feedback_type IS 'Type of feedback: positive (thumbs up) or negative (thumbs down)';
COMMENT ON COLUMN public.rlhf_feedback.tool_calls IS 'JSON array of tools that were called during this response';