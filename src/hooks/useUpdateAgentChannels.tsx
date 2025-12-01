import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UpdateAgentChannelsData {
  profileId: string;
  channelIds: string[];
}

export function useUpdateAgentChannels() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ profileId, channelIds }: UpdateAgentChannelsData) => {
      // 1. Remover todos os canais antigos
      const { error: deleteError } = await supabase
        .from("agent_support_channels")
        .delete()
        .eq("profile_id", profileId);

      if (deleteError) throw deleteError;

      // 2. Inserir os novos canais
      if (channelIds.length > 0) {
        const { error: insertError } = await supabase
          .from("agent_support_channels")
          .insert(
            channelIds.map(channelId => ({
              profile_id: profileId,
              channel_id: channelId,
            }))
          );

        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["agent-support-channels", variables.profileId] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "Canais atualizados!",
        description: "Os canais de atendimento do agente foram atualizados com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar canais",
        description: error.message,
      });
    },
  });
}
