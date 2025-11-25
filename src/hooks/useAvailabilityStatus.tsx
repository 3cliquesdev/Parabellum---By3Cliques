import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

type AvailabilityStatus = "online" | "busy" | "offline";

export function useAvailabilityStatus() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current status
  const { data: status, isLoading } = useQuery({
    queryKey: ["availability-status", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("availability_status")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("[useAvailabilityStatus] Error fetching status:", error);
        throw error;
      }

      return data?.availability_status as AvailabilityStatus;
    },
    enabled: !!user,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: AvailabilityStatus) => {
      if (!user) throw new Error("Usuário não autenticado");

      console.log(`[useAvailabilityStatus] Updating status to: ${newStatus}`);

      const { error } = await supabase
        .from("profiles")
        .update({ availability_status: newStatus })
        .eq("id", user.id);

      if (error) throw error;

      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["availability-status", user?.id] });
      
      const messages = {
        online: "Você está online e receberá novas conversas",
        busy: "Status alterado para Ocupado - você não receberá novos chats",
        offline: "Você está offline - não receberá conversas",
      };

      toast({
        title: "Status atualizado",
        description: messages[newStatus],
      });
    },
    onError: (error: Error) => {
      console.error("[useAvailabilityStatus] Error updating status:", error);
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Realtime subscription for status changes
  useEffect(() => {
    if (!user) return;

    console.log("[useAvailabilityStatus] Setting up Realtime subscription");

    const channel = supabase
      .channel(`availability-status-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log("[useAvailabilityStatus] Realtime update:", payload);
          queryClient.invalidateQueries({ queryKey: ["availability-status", user.id] });
        }
      )
      .subscribe();

    return () => {
      console.log("[useAvailabilityStatus] Cleaning up Realtime subscription");
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Auto-set to offline on logout
  useEffect(() => {
    if (!user) return;

    const handleBeforeUnload = async () => {
      // Set status to offline when user closes browser/tab
      await supabase
        .from("profiles")
        .update({ availability_status: "offline" })
        .eq("id", user.id);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user]);

  return {
    status,
    isLoading,
    updateStatus: updateStatusMutation.mutate,
    isUpdating: updateStatusMutation.isPending,
  };
}
