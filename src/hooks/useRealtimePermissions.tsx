import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export function useRealtimePermissions() {
  const queryClient = useQueryClient();
  const { role } = useUserRole();
  const { user } = useAuth();
  
  useEffect(() => {
    if (!role) return;

    const channel = supabase
      .channel('role-permissions-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'role_permissions',
      }, (payload: any) => {
        // Só invalidar se a mudança é para o role do usuário atual
        const changedRole = payload?.new?.role || payload?.old?.role;
        if (changedRole && changedRole !== role) return;
        
        // ✅ Invalidar TODAS as queries relacionadas
        queryClient.invalidateQueries({ queryKey: ['role-permissions', role] });
        queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
        queryClient.invalidateQueries({ queryKey: ['user-role', user?.id] });
        
        // ✅ Force re-render via version bump
        queryClient.setQueryData(["permissions-version"], (v: number | undefined) => (v || 0) + 1);
        
        toast.info("🔄 Suas permissões foram atualizadas!", {
          description: "A página será atualizada automaticamente.",
          duration: 3000,
        });
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, user?.id, queryClient]);
}
