/**
 * Centralized minimal select strings for Supabase queries.
 * Avoids select(*) and ensures only rendered columns are fetched.
 */

export const TICKET_SELECT = `
  id, ticket_number, subject, description, status, priority,
  category, channel, created_at, updated_at, due_date,
  customer_id, assigned_to, created_by, department_id,
  requesting_department_id, origin_id, operation_id,
  conversation_id, source_conversation_id,
  merged_to_ticket_id,
  approved_by, approved_at, rejection_reason,
  attachments, internal_note, first_response_at, resolved_at,
  customer:contacts(id, first_name, last_name, email, phone, avatar_url, company, address, city, state, zip_code),
  assigned_user:profiles!tickets_assigned_to_fkey(id, full_name, avatar_url),
  created_by_user:profiles!tickets_created_by_fkey(id, full_name, avatar_url),
  department:departments!tickets_department_id_fkey(id, name, color),
  requesting_department:departments!tickets_requesting_department_id_fkey(id, name, color),
  operation:ticket_operations(id, name, color),
  origin:ticket_origins!tickets_origin_id_fkey(id, name, color)
`;

export const DEAL_SELECT = `
  *,
  contacts(id, first_name, last_name, email, phone, company),
  organizations(name),
  assigned_user:profiles!deals_assigned_to_fkey(id, full_name, avatar_url)
`;
