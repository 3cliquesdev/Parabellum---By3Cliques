-- Índices para otimização de queries de clientes existentes
CREATE INDEX IF NOT EXISTS idx_deals_returning_customer 
ON deals(is_returning_customer, status) 
WHERE is_returning_customer = true;

CREATE INDEX IF NOT EXISTS idx_deals_contact_status 
ON deals(contact_id, status);

CREATE INDEX IF NOT EXISTS idx_kiwify_customer_email_event 
ON kiwify_events(customer_email, event_type);

CREATE INDEX IF NOT EXISTS idx_kiwify_processed 
ON kiwify_events(processed) 
WHERE processed = false;

-- Índice para consultas de tickets por assignee
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_status 
ON tickets(assigned_to, status);

-- Índice para consultas de conversas por assignee
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_status 
ON conversations(assigned_to, status);