-- Sprint 1 Part 3: Popular inbox_view com dados existentes e habilitar realtime

INSERT INTO inbox_view (
  conversation_id,
  contact_id,
  contact_name,
  contact_avatar,
  contact_phone,
  contact_email,
  last_message_at,
  last_snippet,
  last_channel,
  last_sender_type,
  unread_count,
  channels,
  status,
  ai_mode,
  assigned_to,
  department,
  sla_status
)
SELECT 
  c.id,
  c.contact_id,
  COALESCE(ct.first_name || ' ' || ct.last_name, 'Desconhecido'),
  ct.avatar_url,
  ct.phone,
  ct.email,
  c.last_message_at,
  (SELECT LEFT(content, 100) FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1),
  c.channel::TEXT,
  (SELECT sender_type::TEXT FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1),
  0,
  ARRAY[c.channel::TEXT],
  c.status::TEXT,
  c.ai_mode::TEXT,
  c.assigned_to,
  c.department,
  calculate_sla_status(
    c.last_message_at,
    (SELECT sender_type::TEXT FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1),
    c.status::TEXT
  )
FROM conversations c
JOIN contacts ct ON ct.id = c.contact_id
ON CONFLICT (conversation_id) DO NOTHING;

-- Habilitar realtime para inbox_view
ALTER PUBLICATION supabase_realtime ADD TABLE inbox_view;