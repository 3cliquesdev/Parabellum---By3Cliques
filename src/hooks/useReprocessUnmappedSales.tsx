import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReprocessRequest {
  kiwify_product_id: string;
}

interface ReprocessResponse {
  success: boolean;
  processed: number;
  playbooks_created: number;
  product_name: string;
  contact_ids: string[];
}

export function useReprocessUnmappedSales() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (request: ReprocessRequest): Promise<ReprocessResponse> => {
      const { data, error } = await supabase.functions.invoke('reprocess-unmapped-sales', {
        body: request,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['unmapped-product-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['products-mapping-diagnostic'] });
      
      toast({
        title: "✅ Reprocessamento concluído",
        description: `${data.processed} ${data.processed === 1 ? 'cliente processado' : 'clientes processados'}, ${data.playbooks_created} ${data.playbooks_created === 1 ? 'playbook iniciado' : 'playbooks iniciados'}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao reprocessar vendas",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
