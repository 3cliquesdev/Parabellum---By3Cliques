import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';

export function useTickets(statusFilter?: TicketStatus, assignedFilter?: 'mine' | 'unassigned' | 'all', agentFilter?: string) {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["tickets", statusFilter, assignedFilter, agentFilter, user?.id],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("tickets")
        .select(`
          *,
          customer:contacts(
            id,
            first_name,
            last_name,
            email,
            phone,
            company,
            address,
            city,
            state,
            zip_code,
            avatar_url
          ),
          assigned_user:profiles!tickets_assigned_to_fkey(
            id,
            full_name,
            avatar_url
          ),
          department:departments(
            id,
            name,
            color
          )
        `)
        .order("created_at", { ascending: false });

      // Filtro por status
      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      // Filtro por atribuição
      if (assignedFilter === 'mine') {
        query = query.eq("assigned_to", user.id);
      } else if (assignedFilter === 'unassigned') {
        query = query.is("assigned_to", null);
      }

      // Filtro por agente específico (para support_manager auditar)
      if (agentFilter) {
        query = query.eq("assigned_to", agentFilter);
      }

      // Sales rep só vê tickets atribuídos a ele (já filtrado por RLS)
      // Support Agent só vê tickets atribuídos ou não atribuídos (RLS)
      // Support Manager vê todos (RLS)
      // Admin/Manager veem todos (permitido por RLS)

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}
