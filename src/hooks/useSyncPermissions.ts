import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { universalMenuGroups } from "@/config/routes";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface SyncResult {
  inserted: number;
  keys: string[];
}

/**
 * Extrai todas as permission keys únicas de routes.ts
 * com label e category derivados do menu
 */
function extractAllPermissionKeys(): Array<{ key: string; label: string; category: string }> {
  const seen = new Set<string>();
  const result: Array<{ key: string; label: string; category: string }> = [];

  for (const group of universalMenuGroups) {
    for (const item of group.items) {
      if (!seen.has(item.permission)) {
        seen.add(item.permission);
        const category = item.permission.split(".")[0];
        result.push({
          key: item.permission,
          label: item.title,
          category,
        });
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
      // 1. Buscar todas as permission keys existentes no banco
      const { data: existing, error: fetchError } = await supabase
        .from("role_permissions")
        .select("role, permission_key");

      if (fetchError) throw fetchError;

      // 2. Buscar todos os roles existentes
      const existingRoles = [...new Set((existing || []).map((e: any) => e.role))];
      const existingKeysByRole = new Map<string, Set<string>>();
      
      for (const row of existing || []) {
        const r = row as any;
        if (!existingKeysByRole.has(r.role)) {
          existingKeysByRole.set(r.role, new Set());
        }
        existingKeysByRole.get(r.role)!.add(r.permission_key);
      }

      // 3. Extrair todas as keys do frontend
      const allKeys = extractAllPermissionKeys();

      // 4. Calcular o que falta inserir
      const toInsert: Array<{
        role: string;
        permission_key: string;
        permission_label: string;
        permission_category: string;
        enabled: boolean;
      }> = [];

      const fullAccessRoles = ["admin", "general_manager", "manager", "cs_manager", "support_manager", "financial_manager"];

      for (const role of existingRoles) {
        const roleKeys = existingKeysByRole.get(role as string) || new Set();
        for (const k of allKeys) {
          if (!roleKeys.has(k.key)) {
            toInsert.push({
              role: role as string,
              permission_key: k.key,
              permission_label: k.label,
              permission_category: k.category,
              enabled: fullAccessRoles.includes(role as string),
            });
          }
        }
      }

      if (toInsert.length === 0) {
        toast.info("Todas as permissões já estão sincronizadas!");
        return { inserted: 0, keys: [] };
      }

      // 5. Inserir em lotes de 100
      const batchSize = 100;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("role_permissions")
          .insert(batch);
        if (insertError) throw insertError;
      }

      // 6. Invalidar cache
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
