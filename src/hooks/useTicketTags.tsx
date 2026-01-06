import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useTicketTags(ticketId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["ticket-tags", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      
      const { data, error } = await supabase
        .from("ticket_tags")
        .select("*, tags(*)")
        .eq("ticket_id", ticketId);

      if (error) throw error;
      return data;
    },
    enabled: !!ticketId,
  });

  const addTag = useMutation({
    mutationFn: async (tagId: string) => {
      if (!ticketId) throw new Error("Ticket ID is required");
      
      const { data, error } = await supabase
        .from("ticket_tags")
        .insert({ ticket_id: ticketId, tag_id: tagId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-tags", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast({ title: "Tag adicionada com sucesso" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeTag = useMutation({
    mutationFn: async (tagId: string) => {
      if (!ticketId) throw new Error("Ticket ID is required");
      
      const { error } = await supabase
        .from("ticket_tags")
        .delete()
        .eq("ticket_id", ticketId)
        .eq("tag_id", tagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-tags", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast({ title: "Tag removida com sucesso" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return { ...query, addTag, removeTag };
}
