import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useActiveTicketStatuses } from "@/hooks/useTicketStatuses";

export interface TicketCounts {
  [key: string]: number;
}

export function useTicketCounts() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const { data: statuses } = useActiveTicketStatuses();

  const canSeeAllTickets = ['admin', 'manager', 'support_manager', 'cs_manager', 'general_manager', 'financial_manager'].includes(role || '');

  // Get archived status names for filtering
  const archivedStatusNames = statuses?.filter(s => s.is_archived_status).map(s => s.name) || ['resolved', 'closed'];

  return useQuery({
    queryKey: ["ticket-counts", user?.id, role, statuses?.map(s => s.name).join(',')],
    queryFn: async (): Promise<TicketCounts> => {
      if (!user) {
        return {
          total: 0,
          my_open: 0,
          unassigned: 0,
          sla_expired: 0,
          archived: 0,
        };
      }

      // Build base query depending on role
      let baseFilter = canSeeAllTickets 
        ? '' 
        : `assigned_to.eq.${user.id},assigned_to.is.null,created_by.eq.${user.id}`;

      // Fetch all tickets that user can see (without status filter)
      let query = supabase
        .from("tickets")
        .select("id, status, assigned_to, due_date, created_by");

      if (!canSeeAllTickets) {
        query = query.or(baseFilter);
      }

      const { data: tickets, error } = await query;

      if (error) throw error;

      const now = new Date();
      const counts: TicketCounts = {
        total: 0,
        my_open: 0,
        unassigned: 0,
        sla_expired: 0,
        archived: 0,
      };

      // Initialize counts for all statuses
      if (statuses) {
        statuses.forEach(status => {
          counts[status.name] = 0;
        });
      }

      tickets?.forEach(ticket => {
        const isArchived = archivedStatusNames.includes(ticket.status);
        
        // Status counts (increment dynamically based on status name)
        if (counts[ticket.status] !== undefined) {
          counts[ticket.status]++;
        } else {
          // Handle unknown statuses
          counts[ticket.status] = (counts[ticket.status] || 0) + 1;
        }

        // Total = apenas ativos (não arquivados)
        if (!isArchived) {
          counts.total++;
        }

        // Archived = all archived statuses
        if (isArchived) {
          counts.archived++;
        }

        // My open tickets
        if (ticket.assigned_to === user.id && !isArchived) {
          counts.my_open++;
        }

        // Unassigned (apenas ativos)
        if (!ticket.assigned_to && !isArchived) {
          counts.unassigned++;
        }

        // SLA expired
        if (
          ticket.due_date && 
          new Date(ticket.due_date) < now && 
          !isArchived
        ) {
          counts.sla_expired++;
        }
      });

      return counts;
    },
    enabled: !!user && !!statuses,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
