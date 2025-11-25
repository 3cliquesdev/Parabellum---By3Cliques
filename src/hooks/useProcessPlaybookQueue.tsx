import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useProcessPlaybookQueue() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "process-playbook-queue",
        { body: { manual_trigger: true } }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: (result) => {
      toast({
        title: "Fila processada",
        description: `${result.processed} items processados com sucesso`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao processar fila",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
