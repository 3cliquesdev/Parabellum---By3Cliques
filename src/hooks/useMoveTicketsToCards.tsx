import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

interface Ticket {
  id: string;
  subject: string;
  description: string | null;
  priority: string;
  customer_id: string | null;
  assigned_to: string | null;
  attachments: Json | null;
}

interface MoveTicketsParams {
  tickets: Ticket[];
  boardId: string;
  columnId: string;
}

export function useMoveTicketsToCards() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ tickets, boardId, columnId }: MoveTicketsParams) => {
      if (tickets.length === 0) {
        throw new Error("Nenhum ticket selecionado");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Get max position in target column
      const { data: existingCards } = await supabase
        .from("project_cards")
        .select("position")
        .eq("column_id", columnId)
        .order("position", { ascending: false })
        .limit(1);

      let position = (existingCards?.[0]?.position ?? -1) + 1;

      // Create cards from tickets
      const cardsToInsert = tickets.map((ticket, index) => ({
        board_id: boardId,
        column_id: columnId,
        title: ticket.subject,
        description: ticket.description,
        priority: ticket.priority as "low" | "medium" | "high" | "urgent",
        position: position + index,
        contact_id: ticket.customer_id,
        created_by: user.id,
      }));

      const { data: insertedCards, error: insertError } = await supabase
        .from("project_cards")
        .insert(cardsToInsert)
        .select();

      if (insertError) throw insertError;

      // Add assignees for cards that had assigned tickets
      const assigneesToInsert = tickets
        .map((ticket, index) => {
          if (!ticket.assigned_to || !insertedCards[index]) return null;
          return {
            card_id: insertedCards[index].id,
            user_id: ticket.assigned_to,
          };
        })
        .filter(Boolean);

      if (assigneesToInsert.length > 0) {
        await supabase
          .from("project_card_assignees")
          .insert(assigneesToInsert as { card_id: string; user_id: string }[]);
      }

      // Delete original tickets
      const ticketIds = tickets.map((t) => t.id);
      const { error: deleteError } = await supabase
        .from("tickets")
        .delete()
        .in("id", ticketIds);

      if (deleteError) throw deleteError;

      return {
        cardsCreated: insertedCards.length,
        ticketsDeleted: ticketIds.length,
      };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-cards", variables.boardId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast({
        title: "Tickets movidos com sucesso!",
        description: `${result.cardsCreated} cards criados, ${result.ticketsDeleted} tickets removidos.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao mover tickets",
        description: error.message,
      });
    },
  });
}
