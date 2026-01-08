-- Performance indexes for CRM speed optimization

-- Messages: faster conversation loading
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender_type 
ON messages(sender_type, created_at DESC);

-- Contacts: faster search and listing
CREATE INDEX IF NOT EXISTS idx_contacts_name_search 
ON contacts(first_name, last_name);

CREATE INDEX IF NOT EXISTS idx_contacts_assigned_status 
ON contacts(assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_contacts_created 
ON contacts(created_at DESC);

-- Conversations: faster inbox queries
CREATE INDEX IF NOT EXISTS idx_conversations_status_assigned 
ON conversations(status, assigned_to);

CREATE INDEX IF NOT EXISTS idx_conversations_department_status 
ON conversations(department, status);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message 
ON conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_ai_mode_status 
ON conversations(ai_mode, status);

-- Deals: faster pipeline views
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_stage_status 
ON deals(pipeline_id, stage_id, status);

CREATE INDEX IF NOT EXISTS idx_deals_assigned_status 
ON deals(assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_deals_created 
ON deals(created_at DESC);

-- Tickets: faster ticket listing
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority 
ON tickets(status, priority);

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_status 
ON tickets(assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_tickets_created 
ON tickets(created_at DESC);

-- Conversation tags: faster tag filtering
CREATE INDEX IF NOT EXISTS idx_conversation_tags_tag 
ON conversation_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_conversation_tags_conversation 
ON conversation_tags(conversation_id);