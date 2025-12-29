import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

export interface TicketCounts {
  open: number;
  in_progress: number;
  waiting_customer: number;
  resolved: number;
  closed: number;
  my_open: number;
  unassigned: number;
  sla_expired: number;
  total: number;
  archived: number;
}

export function useTicketCounts() {
  const { user } = useAuth();
  const { role } = useUserRole();

  const canSeeAllTickets = ['admin', 'manager', 'support_manager', 'cs_manager', 'general_manager', 'financial_manager'].includes(role || '');

  return useQuery({
    queryKey: ["ticket-counts", user?.id, role],
    queryFn: async (): Promise<TicketCounts> => {
      if (!user) {
        return {
          open: 0,
          in_progress: 0,
          waiting_customer: 0,
          resolved: 0,
          closed: 0,
          my_open: 0,
          unassigned: 0,
          sla_expired: 0,
          total: 0,
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
        open: 0,
        in_progress: 0,
        waiting_customer: 0,
        resolved: 0,
        closed: 0,
        my_open: 0,
        unassigned: 0,
        sla_expired: 0,
        total: 0,
        archived: 0,
      };

      tickets?.forEach(ticket => {
        const isArchived = ['resolved', 'closed'].includes(ticket.status);
        
        // Status counts
        if (ticket.status === 'open') counts.open++;
        if (ticket.status === 'in_progress') counts.in_progress++;
        if (ticket.status === 'waiting_customer') counts.waiting_customer++;
        if (ticket.status === 'resolved') counts.resolved++;
        if (ticket.status === 'closed') counts.closed++;

        // Total = apenas ativos (não arquivados)
        if (!isArchived) {
          counts.total++;
        }

        // Archived = resolved + closed
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
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
