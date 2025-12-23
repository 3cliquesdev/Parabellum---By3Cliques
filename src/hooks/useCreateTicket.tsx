import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateTicketData {
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string; // Agora é dinâmico
  customer_id: string;
  assigned_to?: string;
  conversation_id?: string;
  attachments?: any[];
  department_id?: string;
}

export function useCreateTicket() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticketData: CreateTicketData) => {
      // Buscar usuário atual para definir created_by
      const { data: { user } } = await supabase.auth.getUser();
      
      // Cast para permitir categorias dinâmicas do banco
      const { data, error } = await supabase
        .from("tickets")
        .insert({
          ...ticketData,
          created_by: user?.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast({
        title: "Ticket criado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar ticket",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
