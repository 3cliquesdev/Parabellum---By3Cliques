import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Contact = Tables<"contacts">;
type ContactInsert = TablesInsert<"contacts">;
type ContactUpdate = TablesUpdate<"contacts">;

export interface ContactFilters {
  searchQuery?: string;
  customerType?: string;
  blocked?: string;
  subscriptionPlan?: string;
  // Advanced filters
  status?: string;
  lastContactFilter?: string;
  ltvMin?: number;
  ltvMax?: number;
  tags?: string[];
  state?: string;
}

/**
 * useContacts - Fetches contacts with optional filters
 * Returns array directly for backward compatibility
 */
export function useContacts(filters?: ContactFilters) {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  return useQuery({
    queryKey: ["contacts", filters, user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select(`
          *,
          organizations (name)
        `)
        .order("created_at", { ascending: false });

      // Basic filters
      if (filters?.searchQuery) {
        query = query.or(
          `first_name.ilike.%${filters.searchQuery}%,last_name.ilike.%${filters.searchQuery}%,email.ilike.%${filters.searchQuery}%,phone.ilike.%${filters.searchQuery}%`
        );
      }

      if (filters?.customerType && filters.customerType !== "all") {
        query = query.eq("customer_type", filters.customerType);
      }

      if (filters?.blocked && filters.blocked !== "all") {
        query = query.eq("blocked", filters.blocked === "true");
      }

      if (filters?.subscriptionPlan && filters.subscriptionPlan !== "all") {
        query = query.eq("subscription_plan", filters.subscriptionPlan);
      }

      // Advanced filters
      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status as "lead" | "customer" | "churned" | "overdue" | "inactive" | "qualified");
      }

      if (filters?.state && filters.state !== "all") {
        query = query.eq("state", filters.state);
      }

      // LTV range
      if (filters?.ltvMin !== undefined) {
        query = query.gte("total_ltv", filters.ltvMin);
      }
      if (filters?.ltvMax !== undefined) {
        query = query.lte("total_ltv", filters.ltvMax);
      }

      // Last contact filter
      if (filters?.lastContactFilter) {
        const now = new Date();
        switch (filters.lastContactFilter) {
          case "7days": {
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            query = query.lt("last_contact_date", sevenDaysAgo.toISOString());
            break;
          }
          case "30days": {
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            query = query.lt("last_contact_date", thirtyDaysAgo.toISOString());
            break;
          }
          case "never":
            query = query.is("last_contact_date", null);
            break;
        }
      }

      // Aplicar limite para otimização de performance
      query = query.limit(1000);

      const { data, error } = await query;
      if (error) throw error;

      // Client-side tag filtering (requires JOIN that's complex in Supabase)
      if (filters?.tags && filters.tags.length > 0) {
        const { data: taggedContacts } = await supabase
          .from("customer_tags")
          .select("customer_id")
          .in("tag_id", filters.tags);
        
        const taggedIds = new Set(taggedContacts?.map(t => t.customer_id) || []);
        return data?.filter(c => taggedIds.has(c.id)) || [];
      }

      return data;
    },
    enabled: !roleLoading,
  });
}

/**
 * useContactsPaginated - Fetches contacts with server-side pagination
 * Use this for large lists (>100 contacts) for better performance
 */
export interface PaginatedContactsResult {
  data: (Contact & { organizations: { name: string } | null })[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useContactsPaginated(
  filters?: ContactFilters, 
  page = 1, 
  pageSize = 50
) {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const offset = (page - 1) * pageSize;

  return useQuery({
    queryKey: ["contacts-paginated", filters, user?.id, role, page, pageSize],
    queryFn: async (): Promise<PaginatedContactsResult> => {
      let query = supabase
        .from("contacts")
        .select(`
          *,
          organizations (name)
        `, { count: 'exact' })
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      // Apply same filters as useContacts
      if (filters?.searchQuery) {
        query = query.or(
          `first_name.ilike.%${filters.searchQuery}%,last_name.ilike.%${filters.searchQuery}%,email.ilike.%${filters.searchQuery}%,phone.ilike.%${filters.searchQuery}%`
        );
      }

      if (filters?.customerType && filters.customerType !== "all") {
        query = query.eq("customer_type", filters.customerType);
      }

      if (filters?.blocked && filters.blocked !== "all") {
        query = query.eq("blocked", filters.blocked === "true");
      }

      if (filters?.subscriptionPlan && filters.subscriptionPlan !== "all") {
        query = query.eq("subscription_plan", filters.subscriptionPlan);
      }

      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status as "lead" | "customer" | "churned" | "overdue" | "inactive" | "qualified");
      }

      if (filters?.state && filters.state !== "all") {
        query = query.eq("state", filters.state);
      }

      if (filters?.ltvMin !== undefined) {
        query = query.gte("total_ltv", filters.ltvMin);
      }
      if (filters?.ltvMax !== undefined) {
        query = query.lte("total_ltv", filters.ltvMax);
      }

      if (filters?.lastContactFilter) {
        const now = new Date();
        switch (filters.lastContactFilter) {
          case "7days": {
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            query = query.lt("last_contact_date", sevenDaysAgo.toISOString());
            break;
          }
          case "30days": {
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            query = query.lt("last_contact_date", thirtyDaysAgo.toISOString());
            break;
          }
          case "never":
            query = query.is("last_contact_date", null);
            break;
        }
      }

      const { data, error, count } = await query;
      if (error) throw error;

      // Client-side tag filtering
      let filteredData = data || [];
      if (filters?.tags && filters.tags.length > 0) {
        const { data: taggedContacts } = await supabase
          .from("customer_tags")
          .select("customer_id")
          .in("tag_id", filters.tags);
        
        const taggedIds = new Set(taggedContacts?.map(t => t.customer_id) || []);
        filteredData = filteredData.filter(c => taggedIds.has(c.id));
      }

      return {
        data: filteredData,
        totalCount: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },
    enabled: !roleLoading,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (contact: ContactInsert) => {
      const { data, error } = await supabase
        .from("contacts")
        .insert(contact)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts-paginated"] });
      toast({
        title: "Contato criado",
        description: "Contato adicionado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar contato",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ContactUpdate }) => {
      const { data, error } = await supabase
        .from("contacts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts-paginated"] });
      toast({
        title: "Contato atualizado",
        description: "Alterações salvas com sucesso.",
      });
    },
    onError: (error: Error) => {
      console.error("[useUpdateContact] Error details:", error);
      console.error("[useUpdateContact] Error name:", error.name);
      console.error("[useUpdateContact] Error stack:", error.stack);
      toast({
        title: "Erro ao atualizar contato",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts-paginated"] });
      toast({
        title: "Contato excluído",
        description: "Contato removido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir contato",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
