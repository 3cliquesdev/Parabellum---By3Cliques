import Dexie, { type Table } from 'dexie';

export interface CachedMessage {
  id: string;
  conversation_id: string;
  content: string;
  sender_type: string;
  sender_id?: string;
  is_ai_generated?: boolean;
  created_at: string;
  synced: boolean; // false = pendente de envio
}

export interface CachedConversation {
  id: string;
  contact_id: string;
  department?: string;
  status: string;
  last_message_at?: string;
}

export interface MessageQueue {
  id?: number; // autoincrement
  conversation_id: string;
  content: string;
  created_at: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  retries: number;
}

class ChatDatabase extends Dexie {
  messages!: Table<CachedMessage>;
  conversations!: Table<CachedConversation>;
  messageQueue!: Table<MessageQueue>;

  constructor() {
    super('CRMChatDB');
    this.version(1).stores({
      messages: 'id, conversation_id, created_at',
      conversations: 'id, contact_id',
      messageQueue: '++id, conversation_id, status'
    });
  }
}

export const db = new ChatDatabase();
