-- Add email_template_id column to ticket_statuses table
ALTER TABLE public.ticket_statuses
ADD COLUMN email_template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.ticket_statuses.email_template_id IS 'Template de e-mail a ser usado quando ticket mudar para este status';