import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BulkTransferParams {
  ticketIds: string[];
  departmentId: string;
  assignedTo?: string;
  internalNote?: string;
}

export function useBulkTransferTickets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ ticketIds, departmentId, assignedTo, internalNote }: BulkTransferParams) => {
      if (ticketIds.length === 0) {
        throw new Error("Nenhum ticket selecionado");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Determine status based on assignment
      const newStatus = assignedTo && assignedTo !== "none" ? "in_progress" : "open";
      const finalAssignedTo = assignedTo === "none" ? null : (assignedTo || null);

      // Update tickets department and optionally assign
      const { error: updateError } = await supabase
        .from("tickets")
        .update({
          department_id: departmentId,
          assigned_to: finalAssignedTo,
          status: newStatus,
        })
        .in("id", ticketIds);

      if (updateError) throw updateError;

      // Add internal comments if note provided
      if (internalNote) {
        const comments = ticketIds.map((ticketId) => ({
          ticket_id: ticketId,
          content: internalNote,
          is_internal: true,
          author_id: user.id,
        }));

        await supabase.from("ticket_comments").insert(comments);
      }

      return ticketIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast({
        title: "Tickets transferidos",
        description: `${count} ticket${count > 1 ? "s" : ""} transferido${count > 1 ? "s" : ""} com sucesso.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao transferir tickets",
        description: error.message,
      });
    },
  });
}
