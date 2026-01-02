import { useLiveQuery } from 'dexie-react-hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { db, CachedContact } from '@/lib/db';
import { supabase } from '@/integrations/supabase/client';

interface UseContactsOfflineOptions {
  statusFilter?: string;
  searchQuery?: string;
  enabled?: boolean;
}

export function useContactsOffline(options: UseContactsOfflineOptions = {}) {
  const { statusFilter, searchQuery, enabled = true } = options;
  const queryClient = useQueryClient();

  // 1. Leitura instantânea do IndexedDB
  const cachedContacts = useLiveQuery(async () => {
    let results = await db.contacts.orderBy('created_at').reverse().toArray();
    
    if (statusFilter) {
      results = results.filter(c => c.status === statusFilter);
    }
    
    if (searchQuery && searchQuery.length >= 2) {
      const query = searchQuery.toLowerCase();
      results = results.filter(c => 
        c.first_name?.toLowerCase().includes(query) ||
        c.last_name?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.phone?.includes(query)
      );
    }
    
    return results;
  }, [statusFilter, searchQuery]);

  // 2. Sync com Supabase em background
  const { data: serverContacts, isLoading, error } = useQuery({
    queryKey: ['contacts-offline-sync', statusFilter, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, status, company, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (statusFilter) {
        query = query.eq('status', statusFilter as 'lead' | 'qualified' | 'customer' | 'churned' | 'inactive' | 'overdue');
      }
      
      if (searchQuery && searchQuery.length >= 2) {
        query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        await db.contacts.bulkPut(data as CachedContact[]);
      }
      
      return data;
    },
    enabled: enabled && navigator.onLine,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });

  // 3. Realtime subscription
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('contacts-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const contact = payload.new as CachedContact;
            await db.contacts.put(contact);
          } else if (payload.eventType === 'DELETE') {
            await db.contacts.delete(payload.old.id);
          }
          
          queryClient.invalidateQueries({ queryKey: ['contacts-offline-sync'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);

  const contacts = serverContacts ?? cachedContacts ?? [];
  const isOffline = !navigator.onLine;
  const hasError = !!error;

  return {
    contacts,
    isLoading: isLoading && !cachedContacts?.length,
    isOffline,
    hasError,
    isCached: !serverContacts && !!cachedContacts?.length,
  };
}

// Sync completo para PWA
export function useSyncContactsCache() {
  return useQuery({
    queryKey: ['contacts-full-sync'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, status, company, created_at')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      if (data && data.length > 0) {
        await db.contacts.bulkPut(data as CachedContact[]);
      }

      return { synced: data?.length ?? 0 };
    },
    enabled: navigator.onLine,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
