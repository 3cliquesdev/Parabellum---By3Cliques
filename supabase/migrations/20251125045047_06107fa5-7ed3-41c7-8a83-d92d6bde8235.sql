-- FASE 5.5A: Adicionar role 'consultant' ao ENUM app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'consultant';