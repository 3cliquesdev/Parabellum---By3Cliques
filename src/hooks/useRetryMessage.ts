import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RetryMessageParams {
  messageId: string;
  conversationId: string;
}

export function useRetryMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, conversationId }: RetryMessageParams) => {
      // 1. Buscar mensagem original
      const { data: msg, error: msgErr } = await supabase
        .from("messages")
        .select("content, metadata, status")
        .eq("id", messageId)
        .single();

      if (msgErr || !msg) throw new Error("Mensagem não encontrada");
      if (msg.status !== 'failed') throw new Error("Mensagem não está com erro");

      const meta = (msg.metadata || {}) as Record<string, any>;

      // 2. Buscar dados da conversa (phone, instance)
      const { data: conv, error: convErr } = await supabase
        .from("conversations")
        .select("contact_id, whatsapp_meta_instance_id, whatsapp_instance_id, whatsapp_provider, contacts(phone)")
        .eq("id", conversationId)
        .single();

      if (convErr || !conv) throw new Error("Conversa não encontrada");

      const phone = (conv.contacts as any)?.phone;
      if (!phone) throw new Error("Telefone do contato não encontrado");

      // Detectar instância Meta
      const instanceId = conv.whatsapp_meta_instance_id || conv.whatsapp_instance_id;
      if (!instanceId) throw new Error("Instância WhatsApp não encontrada");

      // 3. Obter user atual
      const { data: { user } } = await supabase.auth.getUser();

      // 4. Montar payload de reenvio
      const payload: Record<string, any> = {
        phone_number: phone,
        instance_id: instanceId,
        conversation_id: conversationId,
        sender_id: user?.id,
      };

      // Se tinha template no metadata original, reenviar como template
      if (meta.template_name) {
        payload.template = {
          name: meta.template_name,
          language_code: meta.template_language || "pt_BR",
          components: meta.template_components || undefined,
        };
      } else {
        // Mensagem de texto normal
        payload.message = msg.content;
      }

      // 5. Marcar como "sending"
      await supabase
        .from("messages")
        .update({ status: "sending" })
        .eq("id", messageId);

      // 6. Reenviar via edge function
      const { data: result, error: sendErr } = await supabase.functions.invoke(
        "send-meta-whatsapp",
        { body: payload }
      );

      if (sendErr) throw sendErr;
      if (result?.error) throw new Error(result.error);

      // 7. Atualizar status para sent
      await supabase
        .from("messages")
        .update({
          status: "sent",
          metadata: {
            ...meta,
            retried_at: new Date().toISOString(),
            error_code: null,
            error_title: null,
          },
        })
        .eq("id", messageId);

      return result;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["messages", vars.conversationId] });
      toast.success("Mensagem reenviada!");
    },
    onError: async (err: any, vars) => {
      // Reverter para failed se der erro
      await supabase
        .from("messages")
        .update({ status: "failed" })
        .eq("id", vars.messageId);
      
      queryClient.invalidateQueries({ queryKey: ["messages", vars.conversationId] });
      toast.error(`Falha ao reenviar: ${err.message}`);
    },
  });
}
