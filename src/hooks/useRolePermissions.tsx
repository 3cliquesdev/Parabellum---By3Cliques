import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";
import { toast } from "sonner";

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
    staleTime: 60 * 1000, // 1 minuto - permissões recarregam mais rápido
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: true, // Recarrega ao focar na janela
    refetchOnMount: true, // Recarrega ao montar o componente
  });

  const hasPermission = (key: string): boolean => {
    // Admin always has all permissions
    if (role === 'admin') return true;
    // If still loading OR permissions not yet loaded, deny by default
    // This prevents race conditions where loading is false but data isn't ready
    if (isLoading || !permissions) return false;
    return permissions[key] ?? false;
  };

  return { permissions, hasPermission, loading: isLoading };
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
