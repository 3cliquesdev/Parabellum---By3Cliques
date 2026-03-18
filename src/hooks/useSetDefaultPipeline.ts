import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useSetDefaultPipeline() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (pipelineId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("profiles")
        .update({ default_pipeline_id: pipelineId } as any)
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Pipeline padrão salvo!");
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });
}
