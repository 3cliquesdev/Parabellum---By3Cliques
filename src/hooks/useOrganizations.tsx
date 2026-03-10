import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Organization = Tables<"organizations">;
type OrganizationInsert = TablesInsert<"organizations">;
type OrganizationUpdate = TablesUpdate<"organizations">;

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*, contacts(count), deals(value, status), organization_phones(count)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Calculate stats for each organization
      return data.map((org) => {
        const contactsCount = org.contacts?.[0]?.count || 0;
        const phonesCount = (org.organization_phones as any)?.[0]?.count || 0;
        const activeDeals = org.deals?.filter(d => d.status === 'open').length || 0;
        const totalRevenue = org.deals
          ?.filter(d => d.status === 'won')
          .reduce((sum, deal) => sum + (deal.value || 0), 0) || 0;

        return {
          ...org,
          contactsCount,
          phonesCount,
          activeDeals,
          totalRevenue,
        };
      });
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (organization: OrganizationInsert) => {
      const { data, error } = await supabase
        .from("organizations")
        .insert(organization)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast({
        title: "Organização criada",
        description: "Organização adicionada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar organização",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: OrganizationUpdate }) => {
      const { data, error } = await supabase
        .from("organizations")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast({
        title: "Organização atualizada",
        description: "Alterações salvas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar organização",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("organizations").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast({
        title: "Organização excluída",
        description: "Organização removida com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir organização",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
