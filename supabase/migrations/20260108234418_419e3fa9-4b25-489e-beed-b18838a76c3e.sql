-- Add target_board_id and target_column_id to forms table for Kanban integration
ALTER TABLE public.forms 
ADD COLUMN IF NOT EXISTS target_board_id UUID REFERENCES public.project_boards(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS target_column_id UUID REFERENCES public.project_columns(id) ON DELETE SET NULL;