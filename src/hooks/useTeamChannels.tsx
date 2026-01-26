import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TeamChannel {
  id: string;
  team_id: string;
  channel_id: string;
  created_at: string;
  channel?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export function useTeamChannels(teamId?: string) {
  return useQuery({
    queryKey: ["team-channels", teamId],
    queryFn: async () => {
      if (!teamId) return [];
      
      const { data, error } = await supabase
        .from("team_channels")
        .select(`
          *,
          channel:support_channels(id, name, color)
        `)
        .eq("team_id", teamId);

      if (error) throw error;
      return data as TeamChannel[];
    },
    enabled: !!teamId,
  });
}

export function useUpdateTeamChannels() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ teamId, channelIds }: { teamId: string; channelIds: string[] }) => {
      // First, remove all current channels
      const { error: deleteError } = await supabase
        .from("team_channels")
        .delete()
        .eq("team_id", teamId);

      if (deleteError) throw deleteError;

      // Then, add new channels
      if (channelIds.length > 0) {
        const { error: insertError } = await supabase
          .from("team_channels")
          .insert(channelIds.map(channelId => ({ team_id: teamId, channel_id: channelId })));

        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ["team-channels", teamId] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast({ title: "Canais atualizados", description: "Os canais do time foram atualizados." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar canais", description: error.message, variant: "destructive" });
    },
  });
}
