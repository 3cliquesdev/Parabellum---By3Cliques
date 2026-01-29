import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role:
    | "admin"
    | "general_manager"
    | "manager"
    | "sales_rep"
    | "consultant"
    | "support_agent"
    | "support_manager"
    | "financial_manager"
    | "financial_agent"
    | "cs_manager"
    | "ecommerce_analyst";
  full_name?: string;
  job_title?: string;
  avatar_url?: string;
  is_blocked?: boolean;
  blocked_at?: string;
  block_reason?: string;
  is_archived?: boolean;
  archived_at?: string;
  availability_status?: string;
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-users');
      
      if (error) throw error;
      return data.users as UserWithRole[];
    },
    // Evita tela em branco quando a função falha intermitentemente.
    // Componentes que fazem `users.map(...)` continuam funcionando com array vazio.
    placeholderData: [] as UserWithRole[],
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 20,
  });
}
