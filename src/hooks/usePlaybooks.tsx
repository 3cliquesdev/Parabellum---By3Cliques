import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function usePlaybooks() {
  return useQuery({
    queryKey: ["playbooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_playbooks")
        .select(`
          *,
          product:products(id, name),
          creator:profiles(id, full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useBulkTriggerPlaybook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      contactIds,
      playbookId,
      skipExisting = true,
    }: {
      contactIds: string[];
      playbookId: string;
      skipExisting?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("bulk-trigger-playbook", {
        body: { contactIds, playbookId, skipExisting },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["playbook-executions"] });
      toast({
        title: "Disparo iniciado!",
        description: `${data?.processed || 0} clientes processados com sucesso.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no disparo",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
