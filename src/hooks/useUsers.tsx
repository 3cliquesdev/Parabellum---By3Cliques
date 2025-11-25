import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role: "admin" | "manager" | "sales_rep" | "consultant";
  full_name?: string;
  job_title?: string;
  avatar_url?: string;
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-users');
      
      if (error) throw error;
      return data.users as UserWithRole[];
    },
  });
}
