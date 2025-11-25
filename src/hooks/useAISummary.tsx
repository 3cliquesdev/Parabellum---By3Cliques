import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  content: string;
  sender_type: 'user' | 'contact';
}

export function useAISummary() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (messages: Message[]) => {
      const { data, error } = await supabase.functions.invoke('analyze-ticket', {
        body: { mode: 'summary', messages }
      });

      if (error) throw error;
      return data.result as string;
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar resumo AI",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
