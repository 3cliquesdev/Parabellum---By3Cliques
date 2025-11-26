import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";

export function useSendMessageOffline() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      const tempId = `temp-${Date.now()}`;
      const now = new Date().toISOString();

      // 1. Salvar imediatamente no IndexedDB (UI instantânea)
      await db.messageQueue.add({
        conversation_id: conversationId,
        content,
        created_at: now,
        status: 'pending',
        retries: 0
      });

      // 2. Adicionar à lista de mensagens locais (mostra com ícone de relógio)
      await db.messages.add({
        id: tempId,
        conversation_id: conversationId,
        content,
        sender_type: 'contact',
        created_at: now,
        synced: false // Indica mensagem pendente
      });

      // Invalidar queries para atualizar UI
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });

      // 3. Se online, enviar imediatamente
      if (navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from('messages')
            .insert({ 
              conversation_id: conversationId, 
              content, 
              sender_type: 'contact' 
            })
            .select()
            .single();

          if (!error && data) {
            // Sucesso - remover temporária e atualizar com real
            await db.messages.delete(tempId);
            await db.messages.add({ 
              id: data.id,
              conversation_id: data.conversation_id,
              content: data.content,
              sender_type: data.sender_type,
              sender_id: data.sender_id || undefined,
              is_ai_generated: data.is_ai_generated || false,
              created_at: data.created_at,
              synced: true 
            });

            // Atualizar conversation's last_message_at
            await supabase
              .from("conversations")
              .update({ last_message_at: new Date().toISOString() })
              .eq("id", conversationId);

            return data;
          }
        } catch (error) {
          console.error('Erro ao enviar mensagem online:', error);
          // Falhou - Background Sync vai tentar depois
        }
      } else {
        // Offline - Registrar Background Sync
        if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
          try {
            const reg = await navigator.serviceWorker.ready;
            await (reg as any).sync.register('sync-messages');
          } catch (error) {
            console.error('Erro ao registrar background sync:', error);
          }
        }

        toast({
          title: "Mensagem salva",
          description: "Sua mensagem será enviada quando você estiver online.",
        });
      }

      return { id: tempId, synced: false };
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
