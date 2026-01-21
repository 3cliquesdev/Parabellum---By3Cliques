import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import type { TicketFilters } from "@/components/support/TicketFilterPopover";

type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';

export function useTickets(
  statusFilter?: TicketStatus, 
  assignedFilter?: 'mine' | 'unassigned' | 'all' | 'created_by_me', 
  agentFilter?: string,
  advancedFilters?: TicketFilters
) {
  const { user } = useAuth();
  const { role } = useUserRole();

  // Roles that can see all tickets
  const canSeeAllTickets = ['admin', 'manager', 'support_manager', 'cs_manager', 'general_manager', 'financial_manager'].includes(role || '');
  
  // Roles with specific access patterns
  const isConsultant = role === 'consultant';
  const isFinancialAgent = role === 'financial_agent';
  const isSupportAgent = role === 'support_agent';
  const isEcommerceAnalyst = role === 'ecommerce_analyst';
  const isUser = role === 'user';

  return useQuery({
    queryKey: ["tickets", statusFilter, assignedFilter, agentFilter, advancedFilters, user?.id, role],
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
            avatar_url,
            consultant_id
          ),
          assigned_user:profiles!tickets_assigned_to_fkey(
            id,
            full_name,
            avatar_url
          ),
          created_by_user:profiles!tickets_created_by_fkey(
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

      // Filtro por status (legacy)
      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      // CRITICAL: Access control based on role
      // RLS policies handle the actual security, this is for query optimization
      if (canSeeAllTickets) {
        // Manager/admin logic: can see all
        if (assignedFilter === 'mine') {
          query = query.eq("assigned_to", user.id);
        } else if (assignedFilter === 'unassigned') {
          query = query.is("assigned_to", null);
        } else if (assignedFilter === 'created_by_me') {
          query = query.eq("created_by", user.id);
        }
        // "all" for managers = no filter (see everything)
      } else if (isUser) {
        // Users can only see tickets they created
        query = query.eq("created_by", user.id);
      } else if (isConsultant) {
        // Consultants see tickets from contacts they consult + tickets they created
        // RLS handles this, but we optimize the query
        if (assignedFilter === 'created_by_me') {
          query = query.eq("created_by", user.id);
        }
        // For other filters, let RLS handle it (consultant policy filters by consultant_id)
      } else if (isFinancialAgent || isSupportAgent || isEcommerceAnalyst) {
        // Support/Financial/Ecommerce agents: assigned to self, unassigned, or created by self
        if (assignedFilter === 'mine') {
          query = query.eq("assigned_to", user.id);
        } else if (assignedFilter === 'unassigned') {
          query = query.is("assigned_to", null);
        } else if (assignedFilter === 'created_by_me') {
          query = query.eq("created_by", user.id);
        } else {
          // "all" means: assigned to self, unassigned, OR created by self
          query = query.or(`assigned_to.eq.${user.id},assigned_to.is.null,created_by.eq.${user.id}`);
        }
      } else {
        // Default fallback: only see own tickets (safest default)
        query = query.eq("created_by", user.id);
      }

      // Filtro por agente específico (para support_manager auditar)
      if (agentFilter && canSeeAllTickets) {
        query = query.eq("assigned_to", agentFilter);
      }

      // ADVANCED FILTERS
      if (advancedFilters) {
        // Status multi-select
        if (advancedFilters.status.length > 0) {
          query = query.in("status", advancedFilters.status as any);
        }

        // Priority multi-select
        if (advancedFilters.priority.length > 0) {
          query = query.in("priority", advancedFilters.priority as any);
        }

        // Category multi-select
        if (advancedFilters.category.length > 0) {
          query = query.in("category", advancedFilters.category as any);
        }

        // Channel multi-select
        if (advancedFilters.channel.length > 0) {
          query = query.in("channel", advancedFilters.channel as any);
        }

        // Department filter
        if (advancedFilters.departmentId) {
          query = query.eq("department_id", advancedFilters.departmentId);
        }

        // Assigned to filter
        if (advancedFilters.assignedTo) {
          if (advancedFilters.assignedTo === "unassigned") {
            query = query.is("assigned_to", null);
          } else {
            query = query.eq("assigned_to", advancedFilters.assignedTo);
          }
        }

        // Date range
        if (advancedFilters.dateRange?.from) {
          query = query.gte("created_at", advancedFilters.dateRange.from.toISOString());
        }
        if (advancedFilters.dateRange?.to) {
          // Add 1 day to include the end date
          const endDate = new Date(advancedFilters.dateRange.to);
          endDate.setDate(endDate.getDate() + 1);
          query = query.lt("created_at", endDate.toISOString());
        }

        // SLA expired (due_date < now and status not resolved/closed)
        if (advancedFilters.slaExpired) {
          query = query
            .lt("due_date", new Date().toISOString())
            .not("status", "in", '("resolved","closed")');
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      let filteredData = data || [];
      
      // Tag filter (client-side since we need to filter by ticket_tags relation)
      if (advancedFilters?.tags && advancedFilters.tags.length > 0) {
        // Fetch ticket IDs that have the selected tags
        const { data: ticketTagsData } = await supabase
          .from("ticket_tags")
          .select("ticket_id")
          .in("tag_id", advancedFilters.tags);

        if (ticketTagsData) {
          const ticketIdsWithTags = new Set(ticketTagsData.map(tt => tt.ticket_id));
          filteredData = filteredData.filter(ticket => ticketIdsWithTags.has(ticket.id));
        }
      }

      // No tags filter - filter tickets that have NO tags
      if (advancedFilters?.noTags) {
        const { data: allTicketTagsData } = await supabase
          .from("ticket_tags")
          .select("ticket_id");

        const ticketIdsWithAnyTags = new Set(allTicketTagsData?.map(tt => tt.ticket_id) || []);
        filteredData = filteredData.filter(ticket => !ticketIdsWithAnyTags.has(ticket.id));
      }

      // Client-side search filter
      if (advancedFilters?.search) {
        const searchLower = advancedFilters.search.toLowerCase();
        
        // Se busca no histórico está ativa, buscar também nos comentários
        let ticketIdsFromComments: Set<string> = new Set();
        if (advancedFilters.searchInHistory) {
          const { data: commentMatches } = await supabase
            .from("ticket_comments")
            .select("ticket_id")
            .ilike("content", `%${advancedFilters.search}%`);
          
          if (commentMatches) {
            ticketIdsFromComments = new Set(commentMatches.map(c => c.ticket_id));
          }
        }
        
        filteredData = filteredData.filter(ticket => {
          const ticketId = ticket.id.toLowerCase();
          const ticketNumber = (ticket.ticket_number || '').toLowerCase();
          const subject = (ticket.subject || '').toLowerCase();
          const description = (ticket.description || '').toLowerCase();
          const customerFirstName = (ticket.customer?.first_name || '').toLowerCase();
          const customerLastName = (ticket.customer?.last_name || '').toLowerCase();
          const customerEmail = (ticket.customer?.email || '').toLowerCase();
          
          // Match básico em campos do ticket
          const basicMatch = (
            ticketId.includes(searchLower) ||
            ticketNumber.includes(searchLower) ||
            subject.includes(searchLower) ||
            description.includes(searchLower) ||
            customerFirstName.includes(searchLower) ||
            customerLastName.includes(searchLower) ||
            customerEmail.includes(searchLower)
          );
          
          // Se busca no histórico, incluir tickets com match nos comentários
          const historyMatch = advancedFilters.searchInHistory && ticketIdsFromComments.has(ticket.id);
          
          return basicMatch || historyMatch;
        });
      }
      
      return filteredData;
    },
    enabled: !!user,
  });
}
