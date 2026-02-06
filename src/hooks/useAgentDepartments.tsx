import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AgentDepartment {
  id: string;
  department_id: string;
  is_primary: boolean;
  departments: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export function useAgentDepartments(profileId?: string) {
  return useQuery({
    queryKey: ["agent-departments", profileId],
    queryFn: async (): Promise<AgentDepartment[]> => {
      if (!profileId) return [];
      
      const { data, error } = await supabase
        .from("agent_departments")
        .select(`
          id,
          department_id,
          is_primary,
          departments (id, name, color)
        `)
        .eq("profile_id", profileId)
        .order("is_primary", { ascending: false });

      if (error) throw error;
      
      // Normalize departments field (PostgREST may return array or object)
      return (data || []).map(item => ({
        ...item,
        departments: Array.isArray(item.departments) 
          ? item.departments[0] 
          : item.departments
      })) as AgentDepartment[];
    },
    enabled: !!profileId,
  });
}
