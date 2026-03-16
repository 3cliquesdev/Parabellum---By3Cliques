import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAfterHoursKeepOpen() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["after-hours-keep-open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_configurations")
        .select("value")
        .eq("key", "after_hours_keep_open")
        .maybeSingle();

      if (error) {
        console.error("[useAfterHoursKeepOpen] Error:", error);
        return true; // default: manter aberta
      }

      // Se não existir, default é true (manter aberta)
      return data?.value !== "false";
    },
    staleTime: 30000,
  });

  const updateSetting = useMutation({
    mutationFn: async (keepOpen: boolean) => {
      const { error } = await supabase
        .from("system_configurations")
        .upsert(
          {
            key: "after_hours_keep_open",
            value: keepOpen ? "true" : "false",
            category: "inbox",
            description: "Manter conversa aberta fora do horário comercial para distribuição automática",
          },
          { onConflict: "key" }
        );
      if (error) throw error;
    },
    onMutate: async (keepOpen) => {
      await queryClient.cancelQueries({ queryKey: ["after-hours-keep-open"] });
      const previous = queryClient.getQueryData<boolean>(["after-hours-keep-open"]);
      queryClient.setQueryData(["after-hours-keep-open"], keepOpen);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["after-hours-keep-open"], context.previous);
      }
      toast.error("Erro ao atualizar configuração");
    },
    onSuccess: () => {
      toast.success("Configuração atualizada");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["after-hours-keep-open"] });
    },
  });

  return {
    keepOpen: data ?? true,
    isLoading,
    updateKeepOpen: updateSetting.mutate,
  };
}
