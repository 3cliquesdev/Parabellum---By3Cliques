import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export function useAddContactTag() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) => {
      const { data, error } = await supabase
        .from("customer_tags")
        .insert({
          customer_id: contactId,
          tag_id: tagId,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: ["contact-tags", contactId] });
      toast({ title: "Tag adicionada" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar tag", description: error.message, variant: "destructive" });
    },
  });
}

export function useRemoveContactTag() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) => {
      const { error } = await supabase
        .from("customer_tags")
        .delete()
        .eq("customer_id", contactId)
        .eq("tag_id", tagId);

      if (error) throw error;
    },
    onSuccess: (_, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: ["contact-tags", contactId] });
      toast({ title: "Tag removida" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover tag", description: error.message, variant: "destructive" });
    },
  });
}
