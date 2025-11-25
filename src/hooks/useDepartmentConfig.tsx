import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Department } from "./useDepartments";

export function useDepartmentConfig(departmentId?: string) {
  return useQuery({
    queryKey: ["department-config", departmentId],
    queryFn: async () => {
      if (!departmentId) return null;
      
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("id", departmentId)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return data as Department;
    },
    enabled: !!departmentId,
  });
}