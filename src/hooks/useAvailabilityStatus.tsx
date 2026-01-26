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

  // Initialize heartbeat only - NO automatic status changes
  // Status changes are ONLY made by user/admin explicit actions
  useEffect(() => {
    if (!user || isInitializedRef.current) return;
    
    isInitializedRef.current = true;
    
    const initializeHeartbeat = async () => {
      console.log("[useAvailabilityStatus] Initializing - NOT changing status automatically");
      console.log("[useAvailabilityStatus] Status changes are USER/ADMIN decisions only");
      
      // APENAS enviar heartbeat para indicar atividade
      // NÃO mudar o status para "online" - isso é decisão do usuário/admin
      try {
        await supabase
          .from("profiles")
          .update({ 
            last_status_change: new Date().toISOString(),
          })
          .eq("id", user.id);
        
        console.log("[useAvailabilityStatus] Heartbeat initialized (status unchanged)");
      } catch (err) {
        console.error("[useAvailabilityStatus] Initial heartbeat failed:", err);
      }
    };
    
    initializeHeartbeat();
    
    // Iniciar heartbeat periódico para evitar timeout por inatividade
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [user, sendHeartbeat]);

  // Handle page visibility changes - ONLY send heartbeat, NO status changes
  useEffect(() => {
    if (!user) return;
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log("[useAvailabilityStatus] Tab visible - sending heartbeat only (no auto-online)");
        
        // APENAS enviar heartbeat - NÃO mudar status automaticamente
        // O status só muda por decisão explícita do usuário ou admin
        try {
          await supabase
            .from("profiles")
            .update({ 
              last_status_change: new Date().toISOString(),
            })
            .eq("id", user.id);
        } catch (err) {
          console.error("[useAvailabilityStatus] Visibility heartbeat failed:", err);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // REMOVIDO: Auto-offline ao fechar navegador
  // O status NÃO deve mudar automaticamente ao fechar o navegador
  // Se o usuário quiser ficar offline, ele deve clicar explicitamente
  // O CRON check-inactive-users vai marcar como offline após 5min sem heartbeat
  // Isso evita que o status mude sozinho e respeita a decisão do usuário

  return {
    status,
    isLoading,
    updateStatus: updateStatusMutation.mutate,
    isUpdating: updateStatusMutation.isPending,
  };
}