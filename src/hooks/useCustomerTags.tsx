import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useCustomerTags(customerId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["customer-tags", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from("customer_tags")
        .select("*, tags(*)")
        .eq("customer_id", customerId);

      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const addTag = useMutation({
    mutationFn: async (tagId: string) => {
      if (!customerId) throw new Error("Customer ID is required");
      
      const { data, error } = await supabase
        .from("customer_tags")
        .insert({ customer_id: customerId, tag_id: tagId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-tags", customerId] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
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
      if (!customerId) throw new Error("Customer ID is required");
      
      const { error } = await supabase
        .from("customer_tags")
        .delete()
        .eq("customer_id", customerId)
        .eq("tag_id", tagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-tags", customerId] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
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
