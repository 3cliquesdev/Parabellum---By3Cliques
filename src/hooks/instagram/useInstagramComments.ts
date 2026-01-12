import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InstagramComment {
  id: string;
  instagram_comment_id: string;
  post_id: string | null;
  instagram_account_id: string | null;
  username: string;
  instagram_user_id: string | null;
  text: string;
  timestamp: string | null;
  replied: boolean;
  contact_id: string | null;
  deal_id: string | null;
  assigned_to: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  post?: {
    id: string;
    caption: string | null;
    media_url: string | null;
    thumbnail_url: string | null;
    permalink: string | null;
    media_type: string | null;
  };
  contact?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  deal?: {
    id: string;
    title: string;
    status: string;
  };
  assigned_user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface CommentFilters {
  status?: string;
  assigned_to?: string;
  post_id?: string;
  search?: string;
}

export const useInstagramComments = (filters?: CommentFilters) => {
  return useQuery({
    queryKey: ["instagram-comments", filters],
    queryFn: async () => {
      let query = supabase
        .from("instagram_comments")
        .select(`
          *,
          post:instagram_posts(id, caption, media_url, thumbnail_url, permalink, media_type),
          contact:contacts(id, first_name, last_name),
          deal:deals(id, title, status),
          assigned_user:profiles!instagram_comments_assigned_to_fkey(id, full_name, avatar_url)
        `)
        .order("timestamp", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      if (filters?.assigned_to) {
        query = query.eq("assigned_to", filters.assigned_to);
      }

      if (filters?.post_id) {
        query = query.eq("post_id", filters.post_id);
      }

      if (filters?.search) {
        query = query.or(`text.ilike.%${filters.search}%,username.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as InstagramComment[];
    },
  });
};

export const useInstagramComment = (commentId: string) => {
  return useQuery({
    queryKey: ["instagram-comment", commentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instagram_comments")
        .select(`
          *,
          post:instagram_posts(id, caption, media_url, thumbnail_url, permalink, media_type, likes_count, comments_count),
          contact:contacts(id, first_name, last_name, email, phone),
          deal:deals(id, title, status, value),
          assigned_user:profiles!instagram_comments_assigned_to_fkey(id, full_name, avatar_url),
          replies:instagram_comment_replies(id, text, timestamp, sent_by)
        `)
        .eq("id", commentId)
        .single();

      if (error) throw error;
      return data as InstagramComment & { replies: any[] };
    },
    enabled: !!commentId,
  });
};

export const useReplyToComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, text, userId }: { commentId: string; text: string; userId?: string }) => {
      const { data, error } = await supabase.functions.invoke("instagram-reply-comment", {
        body: { comment_id: commentId, text, user_id: userId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["instagram-comments"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-comment", variables.commentId] });
      toast.success("Resposta enviada com sucesso!");
    },
    onError: (error) => {
      console.error("Error replying to comment:", error);
      toast.error(`Erro ao enviar resposta: ${error.message}`);
    },
  });
};

export const useAssignComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, userId }: { commentId: string; userId: string | null }) => {
      const { error } = await supabase
        .from("instagram_comments")
        .update({
          assigned_to: userId,
          status: userId ? "assigned" : "new",
        })
        .eq("id", commentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["instagram-comments"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-comment", variables.commentId] });
      toast.success(variables.userId ? "Comentário atribuído" : "Atribuição removida");
    },
    onError: (error) => {
      console.error("Error assigning comment:", error);
      toast.error("Erro ao atribuir comentário");
    },
  });
};

export const useUpdateCommentStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, status, notes }: { commentId: string; status: string; notes?: string }) => {
      const updateData: any = { status };
      if (notes !== undefined) {
        updateData.notes = notes;
      }

      const { error } = await supabase
        .from("instagram_comments")
        .update(updateData)
        .eq("id", commentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["instagram-comments"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-comment", variables.commentId] });
      toast.success("Status atualizado");
    },
    onError: (error) => {
      console.error("Error updating comment status:", error);
      toast.error("Erro ao atualizar status");
    },
  });
};
