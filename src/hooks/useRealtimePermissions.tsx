import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";
import { toast } from "sonner";

export function useRealtimePermissions() {
  const queryClient = useQueryClient();
  const { role } = useUserRole();
  
  useEffect(() => {
    if (!role) return;

    const channel = supabase
      .channel('role-permissions-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'role_permissions',
        filter: `role=eq.${role}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['role-permissions', role] });
        
        toast.info("🔄 Suas permissões foram atualizadas!", {
          description: "A página será atualizada automaticamente.",
          duration: 3000,
        });
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, queryClient]);
}
