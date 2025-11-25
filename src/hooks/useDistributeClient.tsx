import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DistributionResult {
  success: boolean;
  message?: string;
  contact_id?: string;
  consultant_id?: string;
  distribution_type?: "sticky_agent" | "round_robin";
}

export function useDistributeClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { data, error } = await supabase.rpc("distribute_client_to_consultant", {
        p_contact_id: contactId,
      });

      if (error) throw error;
      
      const result = data as unknown as DistributionResult;
      
      if (!result.success) {
        throw new Error(result.message || "Falha na distribuição");
      }
      
      return result;
    },
    onSuccess: (data, contactId) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["customer-timeline", contactId] });
      
      toast({
        title: "Cliente distribuído com sucesso",
        description: `Cliente atribuído ao consultor via ${
          data.distribution_type === "sticky_agent" ? "Sticky Agent" : "Round Robin"
        }`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao distribuir cliente",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
