-- FASE 1: Add support_manager role to enum (ONLY)
-- Must be in separate migration because enum values must be committed before use
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support_manager';