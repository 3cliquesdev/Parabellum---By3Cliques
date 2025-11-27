import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useDeliveryGroups() {
  return useQuery({
    queryKey: ["delivery-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_groups")
        .select(`
          *,
          group_playbooks(
            id,
            playbook_id,
            position,
            playbook:onboarding_playbooks(id, name)
          )
        `)
        .order("name", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateDeliveryGroup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      is_active: boolean;
      playbook_ids: string[];
    }) => {
      // Create group
      const { data: group, error: groupError } = await supabase
        .from("delivery_groups")
        .insert({
          name: data.name,
          description: data.description,
          is_active: data.is_active,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Link playbooks
      if (data.playbook_ids.length > 0) {
        const { error: linkError } = await supabase
          .from("group_playbooks")
          .insert(
            data.playbook_ids.map((playbook_id, index) => ({
              group_id: group.id,
              playbook_id,
              position: index,
            }))
          );

        if (linkError) throw linkError;
      }

      return group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-groups"] });
      toast({
        title: "Grupo criado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar grupo",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateDeliveryGroup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      name: string;
      description?: string;
      is_active: boolean;
      playbook_ids: string[];
    }) => {
      // Update group
      const { error: groupError } = await supabase
        .from("delivery_groups")
        .update({
          name: data.name,
          description: data.description,
          is_active: data.is_active,
        })
        .eq("id", data.id);

      if (groupError) throw groupError;

      // Delete old links
      const { error: deleteError } = await supabase
        .from("group_playbooks")
        .delete()
        .eq("group_id", data.id);

      if (deleteError) throw deleteError;

      // Insert new links
      if (data.playbook_ids.length > 0) {
        const { error: linkError } = await supabase
          .from("group_playbooks")
          .insert(
            data.playbook_ids.map((playbook_id, index) => ({
              group_id: data.id,
              playbook_id,
              position: index,
            }))
          );

        if (linkError) throw linkError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-groups"] });
      toast({
        title: "Grupo atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar grupo",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteDeliveryGroup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("delivery_groups")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-groups"] });
      toast({
        title: "Grupo excluído com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir grupo",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
