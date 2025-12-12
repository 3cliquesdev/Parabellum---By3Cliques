import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
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

export function useInboxView(filters?: InboxFilters) {
  const { user } = useAuth();
  const { role } = useUserRole();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["inbox-view", user?.id, role, filters],
    queryFn: async () => {
      let query = supabase
        .from("inbox_view")
        .select("*")
        .order("last_message_at", { ascending: false });

      // Apply filters
      if (filters) {
        // Date range filter
        if (filters.dateRange?.from) {
          query = query.gte("last_message_at", filters.dateRange.from.toISOString());
        }
        if (filters.dateRange?.to) {
          const endOfDay = new Date(filters.dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          query = query.lte("last_message_at", endOfDay.toISOString());
        }

        // Channel filter
        if (filters.channels.length > 0) {
          query = query.overlaps("channels", filters.channels);
        }

        // Status filter
        if (filters.status.length > 0) {
          query = query.in("status", filters.status);
        }

        // Assigned to filter
        if (filters.assignedTo) {
          if (filters.assignedTo === "unassigned") {
            query = query.is("assigned_to", null);
          } else {
            query = query.eq("assigned_to", filters.assignedTo);
          }
        }

        // SLA status filter
        if (filters.slaStatus) {
          query = query.eq("sla_status", filters.slaStatus);
        }

        // Has audio filter
        if (filters.hasAudio) {
          query = query.eq("has_audio", true);
        }

        // Has attachments filter
        if (filters.hasAttachments) {
          query = query.eq("has_attachments", true);
        }

        // AI mode filter
        if (filters.aiMode) {
          query = query.eq("ai_mode", filters.aiMode);
        }

        // Department filter
        if (filters.department) {
          query = query.eq("department", filters.department);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      let result = data as InboxViewItem[];

      // Tag filter - client-side via conversation_tags lookup
      if (filters?.tagId) {
        const { data: taggedConversations } = await supabase
          .from("conversation_tags")
          .select("conversation_id")
          .eq("tag_id", filters.tagId);
        
        const taggedIds = new Set(taggedConversations?.map(tc => tc.conversation_id) || []);
        result = result.filter(item => taggedIds.has(item.conversation_id));
      }

      // Client-side search filter (for name, email, phone)
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(item => {
          return (
            item.contact_name?.toLowerCase().includes(searchLower) ||
            item.contact_email?.toLowerCase().includes(searchLower) ||
            item.contact_phone?.includes(filters.search) ||
            item.conversation_id.toLowerCase().includes(searchLower) ||
            item.last_snippet?.toLowerCase().includes(searchLower)
          );
        });
      }

      return result;
    },
    staleTime: 30 * 1000, // 30 seconds cache (muito mais rápido que antes)
    refetchOnWindowFocus: true,
  });

  // Realtime subscription para atualizações
  useEffect(() => {
    const channel = supabase
      .channel("inbox-view-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inbox_view",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["inbox-view"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Função para resetar unread count ao abrir conversa
  const resetUnreadCount = useCallback(async (conversationId: string) => {
    try {
      await supabase.rpc("reset_inbox_unread_count", {
        p_conversation_id: conversationId,
      });
      queryClient.invalidateQueries({ queryKey: ["inbox-view"] });
    } catch (error) {
      console.error("Failed to reset unread count:", error);
    }
  }, [queryClient]);

  return {
    ...query,
    resetUnreadCount,
  };
}

// Hook para contagem por filtros (para badges)
export function useInboxCounts() {
  return useQuery({
    queryKey: ["inbox-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbox_view")
        .select("ai_mode, status, sla_status, unread_count");

      if (error) throw error;

      const items = data || [];
      
      return {
        total: items.length,
        aiQueue: items.filter(i => i.ai_mode === "autopilot" && i.status === "open").length,
        humanQueue: items.filter(i => i.ai_mode !== "autopilot" && i.status === "open").length,
        slaCritical: items.filter(i => i.sla_status === "critical").length,
        slaWarning: items.filter(i => i.sla_status === "warning").length,
        unread: items.reduce((sum, i) => sum + (i.unread_count || 0), 0),
        closed: items.filter(i => i.status === "closed").length,
      };
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // Refresh counts every minute
  });
}
