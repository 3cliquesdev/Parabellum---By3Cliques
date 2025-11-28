import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useSendQuote() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { data, error } = await supabase.functions.invoke('send-quote-email', {
        body: { quote_id: quoteId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao enviar proposta');

      return data;
    },
    onSuccess: (data, quoteId) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      toast({
        title: "✅ Proposta Enviada!",
        description: "O cliente receberá um email com o link para visualização.",
      });
    },
    onError: (error: Error) => {
      console.error('[useSendQuote] Error:', error);
      toast({
        title: "Erro ao enviar proposta",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
