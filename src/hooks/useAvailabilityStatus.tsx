import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useCallback } from "react";

type AvailabilityStatus = "online" | "busy" | "offline";

// Intervalo de heartbeat (2 minutos)
const HEARTBEAT_INTERVAL = 2 * 60 * 1000;

export function useAvailabilityStatus() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

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

  // Função de heartbeat - atualiza last_status_change para indicar atividade
  const sendHeartbeat = useCallback(async () => {
    if (!user) return;
    
    console.log("[useAvailabilityStatus] Sending heartbeat");
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          last_status_change: new Date().toISOString(),
        })
        .eq("id", user.id);
      
      if (error) {
        console.error("[useAvailabilityStatus] Heartbeat error:", error);
      }
    } catch (err) {
      console.error("[useAvailabilityStatus] Heartbeat failed:", err);
    }
  }, [user]);

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: AvailabilityStatus) => {
      if (!user) throw new Error("Usuário não autenticado");

      console.log(`[useAvailabilityStatus] Updating status to: ${newStatus}`);

      const { error } = await supabase
        .from("profiles")
        .update({ 
          availability_status: newStatus,
          last_status_change: new Date().toISOString(),
        })
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

  // Auto-set to online on mount + heartbeat
  useEffect(() => {
    if (!user || isInitializedRef.current) return;
    
    isInitializedRef.current = true;
    
    // Definir como online ao carregar
    const setOnline = async () => {
      console.log("[useAvailabilityStatus] Setting user online on mount");
      await supabase
        .from("profiles")
        .update({ 
          availability_status: "online",
          last_status_change: new Date().toISOString(),
        })
        .eq("id", user.id);
      
      queryClient.invalidateQueries({ queryKey: ["availability-status", user.id] });
    };
    
    setOnline();
    
    // Iniciar heartbeat
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [user, queryClient, sendHeartbeat]);

  // Handle page visibility changes
  useEffect(() => {
    if (!user) return;
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log("[useAvailabilityStatus] Tab visible - setting online");
        await supabase
          .from("profiles")
          .update({ 
            availability_status: "online",
            last_status_change: new Date().toISOString(),
          })
          .eq("id", user.id);
        queryClient.invalidateQueries({ queryKey: ["availability-status", user.id] });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, queryClient]);

  // Tentar marcar offline ao fechar - backup (principal é o CRON check-inactive-users)
  useEffect(() => {
    if (!user) return;

    const handleBeforeUnload = async () => {
      // Tenta marcar offline - pode não completar mas o CRON vai pegar
      try {
        await supabase
          .from("profiles")
          .update({ 
            availability_status: "offline",
            last_status_change: new Date().toISOString(),
          })
          .eq("id", user.id);
        console.log("[useAvailabilityStatus] Marked offline on unload");
      } catch (err) {
        console.log("[useAvailabilityStatus] Unload offline failed - CRON will handle");
      }
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