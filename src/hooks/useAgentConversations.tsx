import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgentConversationStats {
  agentId: string;
  agentName: string;
  avatarUrl: string | null;
  status: string;
  conversationCount: number;
  slaCriticalCount: number;
  slaWarningCount: number;
  slaNormalCount: number;
  avgWaitMinutes: number;
  conversationIds: string[];
}

export function useAgentConversations() {
  return useQuery({
    queryKey: ["agent-conversations-stats"],
    queryFn: async (): Promise<AgentConversationStats[]> => {
      // Buscar atendentes (exceto admin puro)
      const { data: agentRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["support_agent", "sales_rep", "consultant", "support_manager", "cs_manager"]);

      if (rolesError) throw rolesError;

      const agentIds = [...new Set(agentRoles?.map(r => r.user_id) || [])];
      
      if (agentIds.length === 0) return [];

      // Buscar profiles dos agentes
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, availability_status")
        .in("id", agentIds);

      if (profilesError) throw profilesError;

      // Buscar conversas abertas atribuídas a esses agentes
      const { data: conversations, error: convError } = await supabase
        .from("conversations")
        .select("id, assigned_to, last_message_at, status")
        .eq("status", "open")
        .in("assigned_to", agentIds);

      if (convError) throw convError;

      const now = new Date();

      // Calcular stats por agente
      const agentStats: AgentConversationStats[] = (profiles || []).map(profile => {
        const agentConversations = (conversations || []).filter(c => c.assigned_to === profile.id);
        
        let slaCriticalCount = 0;
        let slaWarningCount = 0;
        let slaNormalCount = 0;
        let totalWaitMinutes = 0;

        agentConversations.forEach(conv => {
          const lastMsg = new Date(conv.last_message_at);
          const diffMinutes = Math.floor((now.getTime() - lastMsg.getTime()) / (1000 * 60));
          const diffHours = diffMinutes / 60;
          
          totalWaitMinutes += diffMinutes;

          if (diffHours >= 4) {
            slaCriticalCount++;
          } else if (diffHours >= 1) {
            slaWarningCount++;
          } else {
            slaNormalCount++;
          }
        });

        return {
          agentId: profile.id,
          agentName: profile.full_name || "Sem nome",
          avatarUrl: profile.avatar_url,
          status: profile.availability_status || "offline",
          conversationCount: agentConversations.length,
          slaCriticalCount,
          slaWarningCount,
          slaNormalCount,
          avgWaitMinutes: agentConversations.length > 0 
            ? Math.round(totalWaitMinutes / agentConversations.length) 
            : 0,
          conversationIds: agentConversations.map(c => c.id),
        };
      });

      // Ordenar por quantidade de conversas (maior primeiro)
      return agentStats.sort((a, b) => b.conversationCount - a.conversationCount);
    },
    staleTime: 5 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// Hook para buscar conversas de um agente específico
export function useAgentConversationsList(agentId: string | null) {
  return useQuery({
    queryKey: ["agent-conversations-list", agentId],
    queryFn: async () => {
      if (!agentId) return [];

      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id,
          contact_id,
          last_message_at,
          status,
          ai_mode,
          channel,
          contacts (
            id,
            first_name,
            last_name,
            phone,
            email,
            avatar_url
          )
        `)
        .eq("assigned_to", agentId)
        .eq("status", "open")
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!agentId,
    staleTime: 30 * 1000,
  });
}
