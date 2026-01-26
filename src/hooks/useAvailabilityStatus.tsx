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

  // Auto-set to online on mount + heartbeat + distribute pending conversations
  useEffect(() => {
    if (!user || isInitializedRef.current) return;
    
    isInitializedRef.current = true;
    
    // Verificar status atual antes de mudar para online
    const setOnlineAndDistribute = async () => {
      console.log("[useAvailabilityStatus] Checking current status on mount...");
      
      // 1. Buscar status atual do usuário
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("availability_status")
        .eq("id", user.id)
        .maybeSingle();
      
      const currentStatus = currentProfile?.availability_status;
      console.log(`[useAvailabilityStatus] Current status: ${currentStatus}`);
      
      // 2. Só definir como "online" se estava "offline" ou sem status
      // Se estava "busy", manter o status escolhido pelo usuário
      const shouldSetOnline = currentStatus === 'offline' || !currentStatus;
      
      if (shouldSetOnline) {
        console.log("[useAvailabilityStatus] User was offline, setting to online");
        await supabase
          .from("profiles")
          .update({ 
            availability_status: "online",
            last_status_change: new Date().toISOString(),
          })
          .eq("id", user.id);
        
        queryClient.invalidateQueries({ queryKey: ["availability-status", user.id] });
        
        // 3. Distribuir conversas apenas se ficou online
        console.log("[useAvailabilityStatus] Triggering conversation distribution...");
        
        try {
          const { data, error } = await supabase.functions.invoke('distribute-pending-conversations', {
            body: { agentId: user.id, maxConversations: 5 }
          });
          
          if (error) {
            console.error("[useAvailabilityStatus] Distribution error:", error);
          } else if (data?.distributed > 0) {
            console.log(`[useAvailabilityStatus] ✅ ${data.distributed} conversas distribuídas`);
            toast({
              title: "📥 Novas conversas atribuídas",
              description: `Você recebeu ${data.distributed} conversa(s) que estavam aguardando atendimento.`,
            });
          } else {
            console.log("[useAvailabilityStatus] Nenhuma conversa pendente para distribuir");
          }
        } catch (err) {
          console.error("[useAvailabilityStatus] Distribution failed:", err);
        }
      } else {
        console.log(`[useAvailabilityStatus] Keeping current status: ${currentStatus} (respecting user choice)`);
        // Apenas atualizar o heartbeat para indicar atividade
        await supabase
          .from("profiles")
          .update({ 
            last_status_change: new Date().toISOString(),
          })
          .eq("id", user.id);
      }
    };
    
    setOnlineAndDistribute();
    
    // Iniciar heartbeat
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [user, queryClient, sendHeartbeat, toast]);

  // Handle page visibility changes
  useEffect(() => {
    if (!user) return;
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log("[useAvailabilityStatus] Tab visible - checking current status...");
        
        // Buscar status atual antes de mudar
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("availability_status")
          .eq("id", user.id)
          .maybeSingle();
        
        const currentStatus = currentProfile?.availability_status;
        
        // Só voltar para online se estava offline
        // Se estava "busy", respeitar a escolha do usuário
        if (currentStatus === 'offline') {
          console.log("[useAvailabilityStatus] Tab visible + was offline - setting online");
          await supabase
            .from("profiles")
            .update({ 
              availability_status: "online",
              last_status_change: new Date().toISOString(),
            })
            .eq("id", user.id);
          queryClient.invalidateQueries({ queryKey: ["availability-status", user.id] });
        } else {
          console.log(`[useAvailabilityStatus] Tab visible - keeping ${currentStatus}`);
          // Apenas enviar heartbeat para indicar atividade
          await supabase
            .from("profiles")
            .update({ 
              last_status_change: new Date().toISOString(),
            })
            .eq("id", user.id);
        }
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