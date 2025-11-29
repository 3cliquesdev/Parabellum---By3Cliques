/**
 * SECURITY: Custom Supabase client for public chat widget
 * 
 * This client includes the session token in headers to enable RLS policies
 * that scope anonymous users to their own conversations only.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Creates a Supabase client with session token authentication
 * for anonymous web_chat users
 */
export function createPublicChatClient() {
  // Get session token from localStorage
  const sessionToken = localStorage.getItem('web_chat_session_token');
  
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: localStorage,
      persistSession: false, // Anonymous users don't need persistent auth
      autoRefreshToken: false,
    },
    global: {
      headers: sessionToken ? {
        'x-session-token': sessionToken,
      } : {},
    },
  });

  return client;
}

/**
 * Store session token in localStorage
 */
export function storeSessionToken(token: string) {
  if (token) {
    localStorage.setItem('web_chat_session_token', token);
    console.log('[PublicChat] ✅ Session token stored');
  }
}

/**
 * Get current session token from localStorage
 */
export function getSessionToken(): string | null {
  return localStorage.getItem('web_chat_session_token');
}

/**
 * Clear session token (logout)
 */
export function clearSessionToken() {
  localStorage.removeItem('web_chat_session_token');
  localStorage.removeItem('active_conversation_id');
  console.log('[PublicChat] Session token cleared');
}
