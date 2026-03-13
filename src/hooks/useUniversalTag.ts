import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTags, useConversationTags, useContactTags } from "@/hooks/useTags";

export function useUniversalTag(conversationId?: string, contactId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: allTags = [], isLoading: isLoadingTags } = useTags();
  const { data: conversationTags = [], isLoading: isLoadingConv } = useConversationTags(conversationId);
  const { data: contactTags = [], isLoading: isLoadingContact } = useContactTags(contactId);

  const currentTag = conversationTags.length > 0 ? conversationTags[0] : null;

  const invalidateAll = () => {
    if (conversationId) {
      queryClient.invalidateQueries({ queryKey: ["conversation-tags", conversationId] });
    }
    if (contactId) {
      queryClient.invalidateQueries({ queryKey: ["contact-tags", contactId] });
      queryClient.invalidateQueries({ queryKey: ["customer-tags", contactId] });
    }
  };

  const selectTag = useMutation({
    mutationFn: async (tagId: string) => {
      // 1. Remove ALL conversation tags (including protected/automatic ones)
      if (conversationId) {
        // Clean protected tags first so the manual tag prevails
        await supabase
          .from("protected_conversation_tags")
          .delete()
          .eq("conversation_id", conversationId);

        await supabase
          .from("conversation_tags")
          .delete()
          .eq("conversation_id", conversationId);
      }

      // 2. Remove ALL old contact tags
      if (contactId && contactTags.length > 0) {
        for (const tag of contactTags) {
          await supabase
            .from("customer_tags")
            .delete()
            .eq("customer_id", contactId)
            .eq("tag_id", (tag as any).id);
        }
      }

      // 3. Add new conversation tag
      if (conversationId) {
        const { error: convErr } = await supabase
          .from("conversation_tags")
          .insert({ conversation_id: conversationId, tag_id: tagId });
        if (convErr) throw convErr;
      }

      // 4. Add new contact tag
      if (contactId && user?.id) {
        const { error: contactErr } = await supabase
          .from("customer_tags")
          .insert({ customer_id: contactId, tag_id: tagId, created_by: user.id });
        if (contactErr) throw contactErr;
      }
    },
    onSuccess: () => {
      invalidateAll();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao definir tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeTag = useMutation({
    mutationFn: async () => {
      if (!currentTag) return;

      if (conversationId) {
        await supabase
          .from("conversation_tags")
          .delete()
          .eq("conversation_id", conversationId)
          .eq("tag_id", currentTag.id);
      }

      if (contactId) {
        await supabase
          .from("customer_tags")
          .delete()
          .eq("customer_id", contactId)
          .eq("tag_id", currentTag.id);
      }
    },
    onSuccess: () => {
      invalidateAll();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    currentTag,
    allTags,
    isLoading: isLoadingTags || isLoadingConv || isLoadingContact,
    selectTag,
    removeTag,
  };
}
