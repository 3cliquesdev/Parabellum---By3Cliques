import { useLiveQuery } from 'dexie-react-hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { db, CachedTicket } from '@/lib/db';
import { supabase } from '@/integrations/supabase/client';

interface UseTicketsOfflineOptions {
  statusFilter?: string;
  assignedTo?: string;
  enabled?: boolean;
}

export function useTicketsOffline(options: UseTicketsOfflineOptions = {}) {
  const { statusFilter, assignedTo, enabled = true } = options;
  const queryClient = useQueryClient();

  // 1. Leitura instantânea do IndexedDB
  const cachedTickets = useLiveQuery(async () => {
    let query = db.tickets.orderBy('created_at');
    
    if (statusFilter) {
      return db.tickets.where('status').equals(statusFilter).reverse().toArray();
    }
    if (assignedTo) {
      return db.tickets.where('assigned_to').equals(assignedTo).reverse().toArray();
    }
    
    return query.reverse().toArray();
  }, [statusFilter, assignedTo]);

  // 2. Sync com Supabase em background
  const { data: serverTickets, isLoading, error } = useQuery({
    queryKey: ['tickets-offline-sync', statusFilter, assignedTo],
    queryFn: async () => {
      let query = supabase
        .from('tickets')
        .select('id, ticket_number, subject, status, priority, customer_id, assigned_to, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (statusFilter) {
        query = query.eq('status', statusFilter as 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed');
      }
      if (assignedTo) {
        query = query.eq('assigned_to', assignedTo);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Mapear customer_id para contact_id no cache
      if (data && data.length > 0) {
        const mappedData = data.map(t => ({
          ...t,
          contact_id: t.customer_id
        })) as CachedTicket[];
        await db.tickets.bulkPut(mappedData);
      }
      
      return data;
    },
    enabled: enabled && navigator.onLine,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });

  // 3. Realtime subscription para novos tickets
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('tickets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        async (payload) => {
          // Atualizar cache local
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const ticket = payload.new as CachedTicket;
            await db.tickets.put(ticket);
          } else if (payload.eventType === 'DELETE') {
            await db.tickets.delete(payload.old.id);
          }
          
          // Invalidar queries
          queryClient.invalidateQueries({ queryKey: ['tickets-offline-sync'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);

  // 4. Retornar dados mais recentes (server > cache)
  const tickets = serverTickets ?? cachedTickets ?? [];
  const isOffline = !navigator.onLine;
  const hasError = !!error;

  return {
    tickets,
    isLoading: isLoading && !cachedTickets?.length,
    isOffline,
    hasError,
    isCached: !serverTickets && !!cachedTickets?.length,
  };
}

// Hook para sincronizar todos os tickets em background (útil para PWA)
export function useSyncTicketsCache() {
  return useQuery({
    queryKey: ['tickets-full-sync'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_number, subject, status, priority, customer_id, assigned_to, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      if (data && data.length > 0) {
        const mappedData = data.map(t => ({
          ...t,
          contact_id: t.customer_id
        })) as CachedTicket[];
        await db.tickets.bulkPut(mappedData);
      }

      return { synced: data?.length ?? 0 };
    },
    enabled: navigator.onLine,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
