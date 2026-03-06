import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";
import { toast } from "sonner";
import { hasFullAccess } from "@/config/roles";

export interface RolePermission {
  id: string;
  role: string;
  permission_key: string;
  permission_label: string;
  permission_category: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function useRolePermissions() {
  const { role } = useUserRole();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ["role-permissions", role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .eq("role", role);

      if (error) throw error;

      // Convert to Map for fast access
      const permMap: Record<string, boolean> = {};
      data?.forEach((p: RolePermission) => {
        permMap[p.permission_key] = p.enabled;
      });
      return permMap;
    },
    enabled: !!role,
    staleTime: 10 * 1000, // 10s - permissões são críticas, devem ser frescas
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: "always", // Ignora staleTime ao focar janela
    refetchOnMount: true, // Recarrega ao montar o componente
  });

  // NOVO: Estado "pronto" para verificar permissões
  const ready = !isLoading && permissions !== undefined;

  // TRI-STATE: true | false | undefined
  // - true: permitido
  // - false: negado (permissões carregadas e explicitamente não habilitado)
  // - undefined: ainda carregando / indeterminado (nunca negar aqui)
  const hasPermission = (key: string): boolean | undefined => {
    // 🆕 Log de diagnóstico (remover após validação em produção)
    console.log(`[hasPermission] key="${key}" role="${role}" fullAccess=${hasFullAccess(role)}`);
    
    // Roles com acesso total sempre true
    if (hasFullAccess(role)) return true;
    
    // 🔥 CRÍTICO: Não negar enquanto carrega - retornar undefined
    if (!ready) return undefined;
    
    // enabled === true é a única condição válida
    return permissions?.[key] === true;
  };

  return { 
    permissions, 
    hasPermission, 
    loading: isLoading,
    ready,  // NOVO: indica se permissões estão prontas para verificação
  };
}

// Hook for managing all permissions (admin only)
export function useAllRolePermissions() {
  return useQuery({
    queryKey: ["all-role-permissions", "v3"], // Force new cache key
    queryFn: async () => {
      const allPermissions: RolePermission[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("role_permissions")
          .select("*")
          .order("role")
          .order("permission_category")
          .order("permission_key")
          .range(from, from + pageSize - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allPermissions.push(...(data as RolePermission[]));
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      console.log("Total permissions loaded:", allPermissions.length);
      return allPermissions;
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for updating a permission
export function useUpdatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("role_permissions")
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar permissão: " + error.message);
    },
  });
}

// Get unique permission keys with labels
export function usePermissionKeys() {
  return useQuery({
    queryKey: ["permission-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("permission_key, permission_label, permission_category")
        .eq("role", "admin"); // Use admin as base for all permission keys

      if (error) throw error;
      return data;
    },
  });
}
