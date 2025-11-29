import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface TransferData {
  ticket_id: string;
  department_id: string;
  internal_note: string;
}

export function useTicketTransfer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ ticket_id, department_id, internal_note }: TransferData) => {
      const { data, error } = await supabase
        .from("tickets")
        .update({
          department_id,
          status: 'in_progress',
          assigned_to: null, // Remove atribuição ao transferir
        })
        .eq("id", ticket_id)
        .select(`
          *,
          department:departments(name)
        `)
        .single();

      if (error) throw error;

      // Criar comentário interno de transferência
      await supabase
        .from("ticket_comments")
        .insert({
          ticket_id,
          content: `📤 Ticket transferido para ${data.department?.name}\n\n${internal_note}`,
          is_internal: true,
          created_by: user?.id,
        });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-comments", data.id] });
      
      toast({
        title: "✅ Ticket Transferido",
        description: `Enviado para ${data.department?.name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao transferir ticket",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
