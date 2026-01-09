-- Create product_board_mappings table
CREATE TABLE public.product_board_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES public.project_boards(id) ON DELETE CASCADE,
  initial_column_id UUID NOT NULL REFERENCES public.project_columns(id) ON DELETE CASCADE,
  form_filled_column_id UUID REFERENCES public.project_columns(id) ON DELETE SET NULL,
  form_id UUID REFERENCES public.forms(id) ON DELETE SET NULL,
  auto_assign_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  send_welcome_email BOOLEAN DEFAULT false,
  email_template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, board_id)
);

-- Add columns to project_cards for tracking
ALTER TABLE public.project_cards 
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS kiwify_order_id TEXT,
ADD COLUMN IF NOT EXISTS form_submission_id UUID REFERENCES public.form_submissions(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_cards_contact_id ON public.project_cards(contact_id);
CREATE INDEX IF NOT EXISTS idx_project_cards_kiwify_order_id ON public.project_cards(kiwify_order_id);
CREATE INDEX IF NOT EXISTS idx_product_board_mappings_product_id ON public.product_board_mappings(product_id);
CREATE INDEX IF NOT EXISTS idx_product_board_mappings_is_active ON public.product_board_mappings(is_active);

-- Enable RLS
ALTER TABLE public.product_board_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_board_mappings
CREATE POLICY "Authenticated users can view product board mappings"
ON public.product_board_mappings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create product board mappings"
ON public.product_board_mappings
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update product board mappings"
ON public.product_board_mappings
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete product board mappings"
ON public.product_board_mappings
FOR DELETE
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_product_board_mappings_updated_at
BEFORE UPDATE ON public.product_board_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();