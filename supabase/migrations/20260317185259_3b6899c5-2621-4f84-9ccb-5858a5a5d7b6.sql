
-- Remove static reason check (now managed dynamically via return_reasons table)
ALTER TABLE public.returns DROP CONSTRAINT IF EXISTS returns_reason_check;

-- Update status check to include 'archived'
ALTER TABLE public.returns DROP CONSTRAINT IF EXISTS returns_status_check;
ALTER TABLE public.returns ADD CONSTRAINT returns_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'refunded', 'archived'));
