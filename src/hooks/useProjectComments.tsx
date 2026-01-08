import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProjectCardComment {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  mentions: string[];
  created_at: string;
  updated_at: string;
  profile?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export function useProjectComments(cardId: string | undefined) {
  return useQuery({
    queryKey: ["project-comments", cardId],
    queryFn: async () => {
      if (!cardId) return [];

      const { data, error } = await supabase
        .from("project_card_comments")
        .select(`
          *,
          profile:profiles(id, full_name, avatar_url)
        `)
        .eq("card_id", cardId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as ProjectCardComment[];
    },
    enabled: !!cardId,
  });
}

// Helper to extract @mentions from text
function extractMentions(content: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[2]); // The UUID is in the second capture group
  }
  
  return mentions;
}

export function useCreateProjectComment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      card_id,
      content,
      board_id,
    }: {
      card_id: string;
      content: string;
      board_id: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const mentions = extractMentions(content);

      const { data, error } = await supabase
        .from("project_card_comments")
        .insert({
          card_id,
          user_id: user.id,
          content,
          mentions,
        })
        .select(`
          *,
          profile:profiles(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from("project_activity_log").insert({
        board_id,
        card_id,
        user_id: user.id,
        action: "comment_added",
        new_value: { comment_id: data.id },
      });

      // TODO: Send notifications to mentioned users via edge function
      if (mentions.length > 0) {
        // This would call an edge function to notify mentioned users
        console.log("Mentions to notify:", mentions);
      }

      return data as ProjectCardComment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-comments", variables.card_id] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao adicionar comentário",
        description: error.message,
      });
    },
  });
}

export function useUpdateProjectComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      card_id,
      content,
    }: {
      id: string;
      card_id: string;
      content: string;
    }) => {
      const mentions = extractMentions(content);

      const { data, error } = await supabase
        .from("project_card_comments")
        .update({ content, mentions })
        .eq("id", id)
        .select(`
          *,
          profile:profiles(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;
      return data as ProjectCardComment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-comments", variables.card_id] });
    },
  });
}

export function useDeleteProjectComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      card_id,
    }: {
      id: string;
      card_id: string;
    }) => {
      const { error } = await supabase
        .from("project_card_comments")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-comments", variables.card_id] });
    },
  });
}
