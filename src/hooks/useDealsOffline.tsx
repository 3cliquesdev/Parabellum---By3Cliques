import { useLiveQuery } from 'dexie-react-hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { db, CachedDeal } from '@/lib/db';
import { supabase } from '@/integrations/supabase/client';

interface UseDealsOfflineOptions {
  statusFilter?: string;
  assignedTo?: string;
  pipelineId?: string;
  enabled?: boolean;
}

export function useDealsOffline(options: UseDealsOfflineOptions = {}) {
  const { statusFilter, assignedTo, pipelineId, enabled = true } = options;
  const queryClient = useQueryClient();

  // 1. Leitura instantânea do IndexedDB
  const cachedDeals = useLiveQuery(async () => {
    if (statusFilter) {
      return db.deals.where('status').equals(statusFilter).reverse().toArray();
    }
    if (assignedTo) {
      return db.deals.where('assigned_to').equals(assignedTo).reverse().toArray();
    }
    if (pipelineId) {
      return db.deals.where('pipeline_id').equals(pipelineId).reverse().toArray();
    }
    
    return db.deals.orderBy('created_at').reverse().toArray();
  }, [statusFilter, assignedTo, pipelineId]);

  // 2. Sync com Supabase em background
  const { data: serverDeals, isLoading, error } = useQuery({
    queryKey: ['deals-offline-sync', statusFilter, assignedTo, pipelineId],
    queryFn: async () => {
      let query = supabase
        .from('deals')
        .select('id, title, value, status, assigned_to, contact_id, pipeline_id, stage_id, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (statusFilter) {
        query = query.eq('status', statusFilter as 'open' | 'won' | 'lost');
      }
      if (assignedTo) {
        query = query.eq('assigned_to', assignedTo);
      }
      if (pipelineId) {
        query = query.eq('pipeline_id', pipelineId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        await db.deals.bulkPut(data as CachedDeal[]);
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
      .channel('deals-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deals',
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const deal = payload.new as CachedDeal;
            await db.deals.put(deal);
          } else if (payload.eventType === 'DELETE') {
            await db.deals.delete(payload.old.id);
          }
          
          queryClient.invalidateQueries({ queryKey: ['deals-offline-sync'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);

  const deals = serverDeals ?? cachedDeals ?? [];
  const isOffline = !navigator.onLine;
  const hasError = !!error;

  return {
    deals,
    isLoading: isLoading && !cachedDeals?.length,
    isOffline,
    hasError,
    isCached: !serverDeals && !!cachedDeals?.length,
  };
}
