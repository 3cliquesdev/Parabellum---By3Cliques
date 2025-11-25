import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GenerateTicketRequest {
  conversation_id: string;
  subject: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'financeiro' | 'tecnico' | 'bug' | 'outro';
  assigned_to?: string;
  internal_note?: string;
}

export function useGenerateTicketFromConversation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: GenerateTicketRequest) => {
      console.log('🎫 Calling generate-ticket-from-conversation Edge Function:', data);

      const { data: result, error } = await supabase.functions.invoke(
        'generate-ticket-from-conversation',
        {
          body: data,
        }
      );

      if (error) {
        console.error('❌ Error from Edge Function:', error);
        throw error;
      }

      console.log('✅ Ticket generated successfully:', result);
      return result;
    },
    onSuccess: (result) => {
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      
      toast({
        title: "✅ Ticket criado com sucesso",
        description: `Ticket #${result.ticket.id.substring(0, 8)} foi gerado da conversa.`,
      });
    },
    onError: (error: any) => {
      console.error('💥 Error generating ticket:', error);
      
      const errorMessage = error?.message || 
                          error?.details?.message || 
                          'Erro desconhecido ao criar ticket';

      toast({
        title: "❌ Erro ao criar ticket",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}
