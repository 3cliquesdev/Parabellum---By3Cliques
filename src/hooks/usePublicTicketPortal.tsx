import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PublicTicketPortalConfig {
  id: string;
  is_active: boolean;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export function usePublicTicketPortalConfig() {
  return useQuery({
    queryKey: ["public-ticket-portal-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_ticket_portal_config")
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return data as PublicTicketPortalConfig | null;
    },
  });
}

export function useTogglePortal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (currentActive: boolean) => {
      // Get config ID first
      const { data: config } = await supabase
        .from("public_ticket_portal_config")
        .select("id")
        .single();

      if (!config) throw new Error("Config not found");

      const { data, error } = await supabase
        .from("public_ticket_portal_config")
        .update({ is_active: !currentActive })
        .eq("id", config.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["public-ticket-portal-config"] });
      toast({
        title: data.is_active ? "Portal ativado" : "Portal desativado",
        description: data.is_active
          ? "Portal público de tickets está agora disponível."
          : "Portal público de tickets foi desativado.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar portal",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
