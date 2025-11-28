import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateCadenceData {
  name: string;
  description?: string;
  is_active?: boolean;
}

export function useCreateCadence() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateCadenceData) => {
      const { data: cadence, error } = await supabase
        .from("cadences")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return cadence;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cadences"] });
      toast({
        title: "Cadência criada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar cadência",
        description: error.message,
      });
    },
  });
}
