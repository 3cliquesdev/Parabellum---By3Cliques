-- Adicionar novo valor ao enum ticket_status
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'pending_approval';

-- Inserir o novo status na tabela ticket_statuses para configuração visual
INSERT INTO public.ticket_statuses (name, label, color, icon, display_order, is_active, send_email_notification, send_whatsapp_notification)
VALUES ('pending_approval', 'Aguard. Aprovação', '#EAB308', 'Clock', 25, true, false, false)
ON CONFLICT (name) DO NOTHING;