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
      console.error('Ticket creation error:', error);
      
      let description = error.message;
      
      // Tratamento específico para erros de RLS
      if (error.message.includes('row-level security')) {
        description = "Você não tem permissão para criar tickets. Verifique se você possui uma role válida (support_agent, support_manager, admin, manager).";
      } else if (error.message.includes('violates foreign key')) {
        description = "Cliente ou usuário inválido. Verifique os dados e tente novamente.";
      } else if (error.message.includes('not-null constraint')) {
        description = "Campos obrigatórios não preenchidos. Verifique os dados e tente novamente.";
      }
      
      toast({
        title: "Erro ao criar ticket",
        description,
        variant: "destructive",
      });
    },
  });
}
