import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface CreateCommentData {
  ticket_id: string;
  content: string;
  is_internal?: boolean;
}

export function useCreateComment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (commentData: CreateCommentData) => {
      const { data, error } = await supabase
        .from("ticket_comments")
        .insert({
          ...commentData,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data, variables) => {
      // Invalidate queries and toast FIRST — comment is saved regardless of email
      queryClient.invalidateQueries({ queryKey: ["ticket-comments", variables.ticket_id] });
      toast({
        title: "Comentário adicionado",
      });

      // Guard: only send email for public comments
      if (variables.is_internal) return;

      // Check if comment email is enabled in system_configurations
      try {
        const { data: configRow } = await supabase
          .from("system_configurations")
          .select("value")
          .eq("key", "ticket_email_customer_comment")
          .maybeSingle();

        if (configRow?.value === "false") {
          console.log("[useCreateComment] Comment email disabled by config, skipping");
          return;
        }
      } catch (cfgErr) {
        console.warn("[useCreateComment] Failed to check email config, proceeding with send:", cfgErr);
      }

      // Notify customer via email (isolated — failure doesn't affect comment)
      try {
        const { error: emailError } = await supabase.functions.invoke("send-ticket-email-reply", {
          body: {
            ticket_id: variables.ticket_id,
            message_content: data.content,
          },
        });

        if (emailError) {
          console.error("[useCreateComment] Email notification failed:", emailError);
          toast({
            title: "Comentário salvo, mas email não enviado",
            description: "O cliente não foi notificado por email.",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error("[useCreateComment] Email notification error:", err);
        toast({
          title: "Comentário salvo, mas email não enviado",
          description: "O cliente não foi notificado por email.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar comentário",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
