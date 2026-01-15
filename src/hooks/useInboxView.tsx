import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import type { DateRange } from "react-day-picker";

export interface InboxViewItem {
  conversation_id: string;
  contact_id: string;
  contact_name: string | null;
  contact_avatar: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  last_message_at: string;
  last_snippet: string | null;
  last_channel: string | null;
  last_sender_type: string | null;
  unread_count: number;
  channels: string[];
  has_audio: boolean;
  has_attachments: boolean;
  status: string;
  ai_mode: string;
  assigned_to: string | null;
  department: string | null;
  sla_status: string;
  created_at: string;
  updated_at: string;
}

export interface InboxFilters {
  dateRange?: DateRange;
  channels: string[];
  status: string[];
  assignedTo?: string;
  search: string;
  slaStatus?: 'ok' | 'warning' | 'critical';
  hasAudio?: boolean;
  hasAttachments?: boolean;
  aiMode?: 'autopilot' | 'copilot' | 'disabled';
  department?: string;
  tagId?: string;
}

const QUERY_KEY = ["inbox-view"];

// Função para buscar dados do inbox com cursor opcional
async function fetchInboxData(cursor?: string): Promise<InboxViewItem[]> {
  let query = supabase
    .from("inbox_view")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (cursor) {
    query = query.gt("updated_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as InboxViewItem[];
}

// Função para aplicar filtros client-side
function applyFilters(items: InboxViewItem[], filters?: InboxFilters): InboxViewItem[] {
  if (!filters) return items;

  let result = [...items];

  // Date range filter
  if (filters.dateRange?.from) {
    result = result.filter(item => 
      new Date(item.last_message_at) >= filters.dateRange!.from!
    );
  }
  if (filters.dateRange?.to) {
    const endOfDay = new Date(filters.dateRange.to);
    endOfDay.setHours(23, 59, 59, 999);
    result = result.filter(item => 
      new Date(item.last_message_at) <= endOfDay
    );
  }

  // Channel filter
  if (filters.channels.length > 0) {
    result = result.filter(item => 
      item.channels?.some(ch => filters.channels.includes(ch))
    );
  }

  // Status filter - por padrão, oculta conversas fechadas (arquivadas)
  if (filters.status.length > 0) {
    result = result.filter(item => filters.status.includes(item.status));
  } else {
    // Padrão: mostrar apenas conversas NÃO fechadas (open, pending, etc.)
    result = result.filter(item => item.status !== 'closed');
  }

  // Assigned to filter
  if (filters.assignedTo) {
    if (filters.assignedTo === "unassigned") {
      result = result.filter(item => !item.assigned_to);
    } else {
      result = result.filter(item => item.assigned_to === filters.assignedTo);
    }
  }

  // SLA status filter
  if (filters.slaStatus) {
    result = result.filter(item => item.sla_status === filters.slaStatus);
  }

  // Has audio filter
  if (filters.hasAudio) {
    result = result.filter(item => item.has_audio);
  }

  // Has attachments filter
  if (filters.hasAttachments) {
    result = result.filter(item => item.has_attachments);
  }

  // AI mode filter
  if (filters.aiMode) {
    result = result.filter(item => item.ai_mode === filters.aiMode);
  }

  // Department filter
  if (filters.department) {
    result = result.filter(item => item.department === filters.department);
  }

  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    result = result.filter(item => 
      item.contact_name?.toLowerCase().includes(searchLower) ||
      item.contact_email?.toLowerCase().includes(searchLower) ||
      item.contact_phone?.includes(filters.search) ||
      item.conversation_id.toLowerCase().includes(searchLower) ||
      item.last_snippet?.toLowerCase().includes(searchLower)
    );
  }

  return result;
}

// Função para fazer merge incremental por conversation_id
function mergeInboxItems(existing: InboxViewItem[], incoming: InboxViewItem[]): InboxViewItem[] {
  const map = new Map(existing.map(item => [item.conversation_id, item]));
  
  for (const item of incoming) {
    map.set(item.conversation_id, { ...map.get(item.conversation_id), ...item });
  }
  
  // Ordenar por updated_at DESC
  return Array.from(map.values()).sort((a, b) => 
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export function useInboxView(filters?: InboxFilters) {
  const { user } = useAuth();
  const { role } = useUserRole();
  const queryClient = useQueryClient();
  const lastSeenRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: [...QUERY_KEY, user?.id, role, filters],
    queryFn: async () => {
      const data = await fetchInboxData();
      
      // Atualizar cursor com o registro mais recente
      if (data.length > 0) {
        lastSeenRef.current = data[0].updated_at;
      }

      // Aplicar filtros de tag (requer lookup separado)
      let result = data;
      if (filters?.tagId) {
        const { data: taggedConversations } = await supabase
          .from("conversation_tags")
          .select("conversation_id")
          .eq("tag_id", filters.tagId);
        
        const taggedIds = new Set(taggedConversations?.map(tc => tc.conversation_id) || []);
        result = result.filter(item => taggedIds.has(item.conversation_id));
      }

      // Aplicar filtros client-side
      return applyFilters(result, filters);
    },
    staleTime: 5000, // Reduzido de 10s para 5s para maior responsividade
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 30000, // Fallback: refetch a cada 30s para garantir sincronia
  });

  // Realtime subscription com merge incremental e catch-up
  useEffect(() => {
    console.log("[Realtime] Setting up inbox_view subscription with incremental merge...");
    
    const channel = supabase
      .channel("inbox-view-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inbox_view",
        },
        (payload) => {
          console.log("[Realtime] inbox_view change:", payload.eventType);
          
          const row = (payload.new || payload.old) as InboxViewItem;
          if (!row?.conversation_id) return;

          // Merge incremental no cache
          queryClient.setQueryData<InboxViewItem[]>(
            [...QUERY_KEY, user?.id, role, filters],
            (prev = []) => {
              if (payload.eventType === "DELETE") {
                return prev.filter(item => item.conversation_id !== row.conversation_id);
              }
              return mergeInboxItems(prev, [row as InboxViewItem]);
            }
          );

          // Atualizar cursor
          if (row.updated_at && (!lastSeenRef.current || row.updated_at > lastSeenRef.current)) {
            lastSeenRef.current = row.updated_at;
          }
        }
      )
      .subscribe(async (status) => {
        console.log("[Realtime] inbox_view subscription status:", status);
        
        // Catch-up ao reconectar
        if (status === "SUBSCRIBED" && lastSeenRef.current) {
          console.log("[Realtime] Running catch-up from cursor:", lastSeenRef.current);
          try {
            const catchUpData = await fetchInboxData(lastSeenRef.current);
            if (catchUpData.length > 0) {
              console.log("[Realtime] Catch-up found", catchUpData.length, "new records");
              queryClient.setQueryData<InboxViewItem[]>(
                [...QUERY_KEY, user?.id, role, filters],
                (prev = []) => mergeInboxItems(prev, catchUpData)
              );
              lastSeenRef.current = catchUpData[0].updated_at;
            }
          } catch (error) {
            console.error("[Realtime] Catch-up failed:", error);
          }
        }
      });

    return () => {
      console.log("[Realtime] Removing inbox_view channel");
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id, role, filters]);

  // Visibility change listener - refetch quando aba volta ao foco
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && lastSeenRef.current) {
        console.log("[Visibility] Tab became visible, running catch-up...");
        fetchInboxData(lastSeenRef.current).then(data => {
          if (data.length > 0) {
            queryClient.setQueryData<InboxViewItem[]>(
              [...QUERY_KEY, user?.id, role, filters],
              (prev = []) => mergeInboxItems(prev, data)
            );
            lastSeenRef.current = data[0].updated_at;
          }
        }).catch(console.error);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [queryClient, user?.id, role, filters]);

  // Função para resetar unread count ao abrir conversa
  const resetUnreadCount = useCallback(async (conversationId: string) => {
    try {
      await supabase.rpc("reset_inbox_unread_count", {
        p_conversation_id: conversationId,
      });
      // Atualização otimista no cache
      queryClient.setQueryData<InboxViewItem[]>(
        [...QUERY_KEY, user?.id, role, filters],
        (prev = []) => prev.map(item => 
          item.conversation_id === conversationId 
            ? { ...item, unread_count: 0 } 
            : item
        )
      );
    } catch (error) {
      console.error("Failed to reset unread count:", error);
    }
  }, [queryClient, user?.id, role, filters]);

  return {
    ...query,
    resetUnreadCount,
  };
}

// Hook para contagem por filtros (para badges) - Estilo Octa
export interface InboxCounts {
  total: number;
  mine: number;
  aiQueue: number;
  humanQueue: number;
  slaCritical: number;
  slaWarning: number;
  notResponded: number;
  unassigned: number;
  unread: number;
  closed: number;
  byDepartment: Array<{ id: string; name: string; color: string | null; count: number }>;
  byTag: Array<{ id: string; name: string; color: string | null; count: number }>;
}

export function useInboxCounts(userId?: string) {
  return useQuery<InboxCounts>({
    queryKey: ["inbox-counts", userId],
    queryFn: async (): Promise<InboxCounts> => {
      // Buscar dados de inbox
      const { data: inboxData, error: inboxError } = await supabase
        .from("inbox_view")
        .select("conversation_id, ai_mode, status, sla_status, unread_count, assigned_to, department, last_sender_type");

      if (inboxError) throw inboxError;

      // Buscar tags por conversa
      const { data: tagsData } = await supabase
        .from("conversation_tags")
        .select("conversation_id, tag_id");

      // Buscar departamentos
      const { data: deptsData } = await supabase
        .from("departments")
        .select("id, name, color")
        .eq("is_active", true) as { data: Array<{ id: string; name: string; color: string | null }> | null };

      // Buscar tags - usando query separada para evitar tipo complexo
      const tagsQuery = supabase.from("tags").select("id, name, color");
      const { data: allTags } = await tagsQuery as unknown as { data: Array<{ id: string; name: string; color: string | null }> | null };

      const items = inboxData || [];
      const openItems = items.filter(i => i.status === "open");

      // Contagem por departamento
      const byDepartment = (deptsData || []).map(dept => ({
        id: dept.id,
        name: dept.name,
        color: dept.color,
        count: openItems.filter(i => i.department === dept.id).length
      }));

      // Contagem por tag
      const tagCounts = new Map<string, number>();
      const conversationTags = tagsData || [];
      const openConversationIds = new Set(openItems.map(i => i.conversation_id));
      
      conversationTags.forEach(ct => {
        if (openConversationIds.has(ct.conversation_id)) {
          tagCounts.set(ct.tag_id, (tagCounts.get(ct.tag_id) || 0) + 1);
        }
      });

      const byTag = (allTags || []).map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        count: tagCounts.get(tag.id) || 0
      }));

      return {
        total: openItems.length,
        mine: userId ? openItems.filter(i => i.assigned_to === userId).length : 0,
        aiQueue: openItems.filter(i => i.ai_mode === "autopilot").length,
        humanQueue: openItems.filter(i => i.ai_mode !== "autopilot").length,
        slaCritical: items.filter(i => i.sla_status === "critical").length,
        slaWarning: items.filter(i => i.sla_status === "warning").length,
        notResponded: openItems.filter(i => i.last_sender_type === "contact").length,
        unassigned: openItems.filter(i => !i.assigned_to).length,
        unread: items.reduce((sum, i) => sum + (i.unread_count || 0), 0),
        closed: items.filter(i => i.status === "closed").length,
        byDepartment,
        byTag,
      };
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
