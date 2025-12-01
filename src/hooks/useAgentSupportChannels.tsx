import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgentSupportChannel {
  profile_id: string;
  channel_id: string;
  support_channels: {
    id: string;
    name: string;
    color: string;
  };
}

export function useAgentSupportChannels(profileId: string | undefined) {
  return useQuery({
    queryKey: ["agent-support-channels", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("agent_support_channels")
        .select(`
          profile_id,
          channel_id,
          support_channels (
            id,
            name,
            color
          )
        `)
        .eq("profile_id", profileId);

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        support_channels: Array.isArray(item.support_channels) 
          ? item.support_channels[0] 
          : item.support_channels
      })) as AgentSupportChannel[];
    },
    enabled: !!profileId,
  });
}
