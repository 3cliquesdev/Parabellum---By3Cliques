import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useTags(category?: string) {
  return useQuery({
    queryKey: ["tags", category],
    queryFn: async () => {
      let query = supabase
        .from("tags")
        .select("*")
        .order("name", { ascending: true });

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      color?: string;
      category?: string;
      description?: string;
    }) => {
      const { data: result, error } = await supabase
        .from("tags")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast({ 
        title: "Tag criada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      color?: string;
      category?: string;
      description?: string;
    }) => {
      const { data: result, error } = await supabase
        .from("tags")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast({ 
        title: "Tag atualizada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tags")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast({ 
        title: "Tag removida com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useContactTags(contactId?: string) {
  return useQuery({
    queryKey: ["contact-tags", contactId],
    queryFn: async () => {
      if (!contactId) return [];
      
      const { data, error } = await supabase
        .from("customer_tags")
        .select(`
          id,
          tag:tags(id, name, color)
        `)
        .eq("customer_id", contactId);

      if (error) throw error;
      return data.map(d => d.tag).filter(Boolean);
    },
    enabled: !!contactId,
  });
}

// Conversation Tags Hooks
export function useConversationTags(conversationId?: string) {
  return useQuery({
    queryKey: ["conversation-tags", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from("conversation_tags")
        .select(`
          id,
          tag:tags(id, name, color, category)
        `)
        .eq("conversation_id", conversationId);

      if (error) throw error;
      return data.map(d => d.tag).filter(Boolean);
    },
    enabled: !!conversationId,
  });
}

export function useAddConversationTag() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ conversationId, tagId }: { conversationId: string; tagId: string }) => {
      // Avoid extra roundtrip/row materialization (can contribute to timeouts under load)
      const { error } = await supabase
        .from("conversation_tags")
        .insert({ conversation_id: conversationId, tag_id: tagId });

      if (error) throw error;
      return { conversationId, tagId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["conversation-tags", variables.conversationId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useRemoveConversationTag() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ conversationId, tagId }: { conversationId: string; tagId: string }) => {
      // Clean protected tag entry if exists, so manual replacement works
      await supabase
        .from("protected_conversation_tags")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("tag_id", tagId);

      const { error } = await supabase
        .from("conversation_tags")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("tag_id", tagId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["conversation-tags", variables.conversationId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
