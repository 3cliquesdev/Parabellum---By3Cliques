-- Add general_manager to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'general_manager';

-- RLS Policies: general_manager has same access as admin/manager for operational tables
-- (No changes needed to most RLS policies since they already use 'admin' OR 'manager' patterns,
-- and general_manager should have similar access to manager role in operational contexts)

-- Note: Sensitive routes like /settings/billing and /settings/api-keys will be blocked at route level, not RLS