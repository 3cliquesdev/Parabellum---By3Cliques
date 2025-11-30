import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useGenerateBatchEmbeddings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-batch-embeddings', {
        body: {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-articles"] });
      
      if (data.processed === 0) {
        toast({
          title: "✓ Base atualizada",
          description: "Todos os artigos já possuem embeddings",
        });
      } else {
        toast({
          title: "✓ Embeddings gerados",
          description: `${data.processed} artigos processados com sucesso${data.errors > 0 ? ` (${data.errors} erros)` : ''}`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar embeddings",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
