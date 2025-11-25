import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Contact = Tables<"contacts">;
type ContactInsert = TablesInsert<"contacts">;
type ContactUpdate = TablesUpdate<"contacts">;

interface ContactFilters {
  searchQuery?: string;
  customerType?: string;
  blocked?: string;
  subscriptionPlan?: string;
}

export function useContacts(filters?: ContactFilters) {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["contacts", filters, user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select("*, organizations(name)")
        .order("created_at", { ascending: false });

      if (filters?.searchQuery) {
        query = query.or(
          `first_name.ilike.%${filters.searchQuery}%,last_name.ilike.%${filters.searchQuery}%,email.ilike.%${filters.searchQuery}%`
        );
      }

      // Filtros avançados
      if (filters?.customerType && filters.customerType !== 'all') {
        query = query.eq("customer_type", filters.customerType);
      }

      if (filters?.blocked && filters.blocked !== 'all') {
        query = query.eq("blocked", filters.blocked === 'true');
      }

      if (filters?.subscriptionPlan && filters.subscriptionPlan !== 'all') {
        query = query.eq("subscription_plan", filters.subscriptionPlan);
      }

      // Filtrar por assigned_to se for sales_rep
      if (role && (role as string) === "sales_rep" && user?.id) {
        query = query.eq("assigned_to", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
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
