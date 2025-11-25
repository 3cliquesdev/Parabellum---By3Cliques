import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook para buscar a persona ativa de uma conversa
 * baseada nas routing rules (canal + departamento)
 */
export const useActivePersona = (conversationId: string | null) => {
  return useQuery({
    queryKey: ["active-persona", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      // Buscar conversa e departamento do contato atribuído
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select(`
          channel,
          contacts!inner(
            assigned_user:profiles!contacts_assigned_to_fkey(department)
          )
        `)
        .eq("id", conversationId)
        .single();

      if (convError) throw convError;

      const contact = conversation.contacts as any;
      const channel = conversation.channel;
      const department = contact?.assigned_user?.department || null;

      // Buscar routing rules que combinam
      const { data: routingRules, error: rulesError } = await supabase
        .from("ai_routing_rules")
        .select(`
          *,
          ai_personas!inner(*)
        `)
        .eq("channel", channel)
        .eq("is_active", true)
        .order("priority", { ascending: false });

      if (rulesError) throw rulesError;

      // Primeiro tentar combinar canal + departamento
      let matchedRule = routingRules?.find(rule => rule.department === department);
      
      // Fallback: regra apenas com canal (department null)
      if (!matchedRule) {
        matchedRule = routingRules?.find(rule => rule.department === null);
      }

      if (!matchedRule || !matchedRule.ai_personas) {
        return null;
      }

      return matchedRule.ai_personas;
    },
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};
