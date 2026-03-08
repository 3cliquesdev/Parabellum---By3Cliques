
-- Tabela de mensagens configuráveis
CREATE TABLE public.business_messages_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_key text UNIQUE NOT NULL,
  message_template text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.business_messages_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read business messages"
  ON public.business_messages_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage business messages"
  ON public.business_messages_config FOR ALL
  TO authenticated
  USING (public.is_manager_or_admin(auth.uid()))
  WITH CHECK (public.is_manager_or_admin(auth.uid()));

-- Seeds
INSERT INTO public.business_messages_config (message_key, message_template, description) VALUES
  ('after_hours_handoff', 'Nosso atendimento humano funciona {schedule}. {next_open} um atendente poderá te ajudar. Enquanto isso, posso continuar tentando por aqui! 😊', 'Mensagem enviada ao cliente quando pede atendente humano fora do horário. Placeholders: {schedule}, {next_open}'),
  ('business_hours_reopened', '☀️ Horário comercial iniciado. Um atendente será designado para continuar seu atendimento.', 'Mensagem enviada quando o horário comercial abre e a conversa pendente é redistribuída.');
