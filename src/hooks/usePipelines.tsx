import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";
import { hasFullAccess } from "@/config/roles";

export function usePipelines() {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["pipelines", user?.id, role],
    queryFn: async () => {
      // 1. Buscar todos os pipelines (com department info)
      const { data: pipelines, error } = await supabase
        .from("pipelines")
        .select("*, departments(id, name, color)")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;

      // 2. Admin/gerente: retorna tudo sem filtro
      if (hasFullAccess(role)) {
        return pipelines;
      }

      // 3. Usuário operacional: buscar department_id do perfil
      if (!user) return pipelines;

      const { data: profile } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", user.id)
        .single();

      const userDeptId = profile?.department;

      // 4. Filtrar: pipelines do departamento do usuário + pipelines sem departamento
      return pipelines.filter(
        (p: any) => !p.department_id || p.department_id === userDeptId
      );
    },
    enabled: !!user,
  });
}
