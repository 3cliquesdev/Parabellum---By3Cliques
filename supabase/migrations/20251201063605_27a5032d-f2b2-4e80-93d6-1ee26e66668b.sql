-- Corrigir status do contato de teste "Ronny Oliveira" para 'customer'
-- Necessário para que o fluxo de saque funcione corretamente nos testes

UPDATE public.contacts
SET status = 'customer'
WHERE email = 'ronildo@liberty.com' 
  AND first_name = 'Ronny'
  AND status != 'customer';

COMMENT ON TABLE public.contacts IS 'Contato Ronny Oliveira atualizado para status=customer para testes de fluxo financeiro';