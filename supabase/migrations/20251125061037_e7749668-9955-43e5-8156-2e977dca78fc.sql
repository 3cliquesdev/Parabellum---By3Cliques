-- FASE 1: Adicionar role support_agent ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'support_agent';