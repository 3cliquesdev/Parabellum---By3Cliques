import Dexie, { type Table } from 'dexie';

export interface CachedMessage {
  id: string;
  conversation_id: string;
  content: string;
  sender_type: string;
  sender_id?: string;
  is_ai_generated?: boolean;
  created_at: string;
  synced: boolean;
}

export interface CachedConversation {
  id: string;
  contact_id: string;
  department?: string;
  status: string;
  last_message_at?: string;
}

export interface MessageQueue {
  id?: number;
  conversation_id: string;
  content: string;
  created_at: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  retries: number;
}

export interface CachedTicket {
  id: string;
  ticket_number: string | null;
  subject: string;
  status: string;
  priority: string;
  contact_id: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface CachedDeal {
  id: string;
  title: string;
  value: number | null;
  status: string;
  assigned_to: string | null;
  contact_id: string | null;
  pipeline_id: string;
  stage_id: string | null;
  created_at: string;
}

export interface CachedContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  company: string | null;
  created_at: string;
}

class CRMDatabase extends Dexie {
  messages!: Table<CachedMessage>;
  conversations!: Table<CachedConversation>;
  messageQueue!: Table<MessageQueue>;
  tickets!: Table<CachedTicket>;
  deals!: Table<CachedDeal>;
  contacts!: Table<CachedContact>;

  constructor() {
    super('CRMChatDB');
    this.version(2).stores({
      messages: 'id, conversation_id, created_at',
      conversations: 'id, contact_id',
      messageQueue: '++id, conversation_id, status',
      tickets: 'id, status, assigned_to, created_at',
      deals: 'id, status, assigned_to, contact_id, pipeline_id',
      contacts: 'id, email, phone, status'
    });
  }
}

export const db = new CRMDatabase();
