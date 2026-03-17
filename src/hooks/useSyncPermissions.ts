import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { universalMenuGroups } from "@/config/routes";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface SyncResult {
  inserted: number;
  keys: string[];
}

function extractAllPermissionKeys(): Array<{ key: string; label: string; category: string }> {
  const seen = new Set<string>();
  const result: Array<{ key: string; label: string; category: string }> = [];

  for (const group of universalMenuGroups) {
    for (const item of group.items) {
      if (!seen.has(item.permission)) {
        seen.add(item.permission);
        const category = item.permission.split(".")[0];
        result.push({ key: item.permission, label: item.title, category });
      }
    }
  }
  return result;
}

export function useSyncPermissions() {
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  const syncPermissions = async (): Promise<SyncResult> => {
    setSyncing(true);
    try {
      const { data: existing, error: fetchError } = await supabase
        .from("role_permissions")
        .select("role, permission_key");

      if (fetchError) throw fetchError;

      const existingRoles = [...new Set((existing || []).map((e) => e.role))];
      const existingKeysByRole = new Map<string, Set<string>>();

      for (const row of existing || []) {
        if (!existingKeysByRole.has(row.role)) {
          existingKeysByRole.set(row.role, new Set());
        }
        existingKeysByRole.get(row.role)!.add(row.permission_key);
      }

      const allKeys = extractAllPermissionKeys();
      const fullAccessRoles = ["admin", "general_manager", "manager", "cs_manager", "support_manager", "financial_manager"];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toInsert: any[] = [];

      for (const role of existingRoles) {
        const roleKeys = existingKeysByRole.get(role) || new Set();
        for (const k of allKeys) {
          if (!roleKeys.has(k.key)) {
            toInsert.push({
              role,
              permission_key: k.key,
              permission_label: k.label,
              permission_category: k.category,
              enabled: fullAccessRoles.includes(role),
            });
          }
        }
      }

      if (toInsert.length === 0) {
        toast.info("Todas as permissões já estão sincronizadas!");
        return { inserted: 0, keys: [] };
      }

      const batchSize = 100;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("role_permissions")
          .insert(batch);
        if (insertError) throw insertError;
      }

      queryClient.invalidateQueries({ queryKey: ["all-role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });

      const uniqueKeys = [...new Set(toInsert.map((r) => r.permission_key))];
      toast.success(`${toInsert.length} permissões sincronizadas (${uniqueKeys.length} keys novas)`);

      return { inserted: toInsert.length, keys: uniqueKeys };
    } catch (err: any) {
      toast.error("Erro ao sincronizar: " + err.message);
      return { inserted: 0, keys: [] };
    } finally {
      setSyncing(false);
    }
  };

  return { syncPermissions, syncing };
}
