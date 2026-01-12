import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InstagramMessage {
  id: string;
  instagram_account_id: string | null;
  conversation_id: string;
  message_id: string;
  from_username: string | null;
  from_instagram_id: string | null;
  text: string | null;
  media_url: string | null;
  is_from_business: boolean;
  timestamp: string | null;
  read: boolean;
  contact_id: string | null;
  deal_id: string | null;
  assigned_to: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface InstagramConversation {
  conversation_id: string;
  from_username: string | null;
  from_instagram_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  status: string;
  assigned_to: string | null;
}

export const useInstagramConversations = () => {
  return useQuery({
    queryKey: ["instagram-conversations"],
    queryFn: async () => {
      // Get all messages grouped by conversation
      const { data, error } = await supabase
        .from("instagram_messages")
        .select("*")
        .order("timestamp", { ascending: false });

      if (error) throw error;

      // Group by conversation_id
      const conversationsMap = new Map<string, InstagramConversation>();

      for (const message of data || []) {
        if (!conversationsMap.has(message.conversation_id)) {
          conversationsMap.set(message.conversation_id, {
            conversation_id: message.conversation_id,
            from_username: message.is_from_business ? null : message.from_username,
            from_instagram_id: message.is_from_business ? null : message.from_instagram_id,
            last_message: message.text,
            last_message_at: message.timestamp,
            unread_count: 0,
            status: message.status,
            assigned_to: message.assigned_to,
          });
        }

        const conv = conversationsMap.get(message.conversation_id)!;
        
        // Update username from customer messages
        if (!message.is_from_business && message.from_username) {
          conv.from_username = message.from_username;
          conv.from_instagram_id = message.from_instagram_id;
        }

        // Count unread messages
        if (!message.is_from_business && !message.read) {
          conv.unread_count++;
        }
      }

      return Array.from(conversationsMap.values()).sort((a, b) => {
        const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return dateB - dateA;
      });
    },
  });
};

export const useInstagramMessages = (conversationId: string) => {
  return useQuery({
    queryKey: ["instagram-messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instagram_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("timestamp", { ascending: true });

      if (error) throw error;
      return data as InstagramMessage[];
    },
    enabled: !!conversationId,
  });
};

export const useSendInstagramMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      text,
      accountId,
      userId,
    }: {
      conversationId: string;
      text: string;
      accountId: string;
      userId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("instagram-send-dm", {
        body: {
          conversation_id: conversationId,
          text,
          account_id: accountId,
          user_id: userId,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["instagram-messages", variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ["instagram-conversations"] });
      toast.success("Mensagem enviada!");
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      toast.error(`Erro ao enviar mensagem: ${error.message}`);
    },
  });
};

export const useMarkMessagesAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from("instagram_messages")
        .update({ read: true, status: "read" })
        .eq("conversation_id", conversationId)
        .eq("is_from_business", false)
        .eq("read", false);

      if (error) throw error;
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["instagram-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["instagram-conversations"] });
    },
  });
};
