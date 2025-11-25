import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUsersByDepartment(departmentId?: string) {
  return useQuery({
    queryKey: ["users-by-department", departmentId],
    queryFn: async () => {
      if (!departmentId) return [];
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, job_title, avatar_url, department")
        .eq("department", departmentId)
        .order("full_name");

      if (error) throw error;
      return data;
    },
    enabled: !!departmentId,
  });
}
