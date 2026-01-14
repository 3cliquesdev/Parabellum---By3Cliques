import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProfilesRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("profiles-global-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        (payload) => {
          console.log("[Realtime] Profile changed:", payload);
          
          // Invalidar todas as queries relacionadas a profiles/usuários
          queryClient.invalidateQueries({ queryKey: ["team-online-status"] });
          queryClient.invalidateQueries({ queryKey: ["users"] });
          queryClient.invalidateQueries({ queryKey: ["availability-status"] });
          queryClient.invalidateQueries({ queryKey: ["profiles"] });
          queryClient.invalidateQueries({ queryKey: ["team-online-count"] });
          
          // Queries usadas no /inbox e outros locais
          queryClient.invalidateQueries({ 
            predicate: (query) => {
              const key = query.queryKey[0];
              return typeof key === 'string' && (
                key.startsWith("users-by-department") ||
                key === "users-by-department" ||
                key === "operational-users" ||
                key === "agent-conversations" ||
                key === "conversations"
              );
            }
          });
          
          // Invalidar por ID específico se disponível
          queryClient.invalidateQueries({ queryKey: ["users-by-department"] });
          queryClient.invalidateQueries({ queryKey: ["operational-users"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
