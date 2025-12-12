import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WhatsAppInstanceChange {
  id: string;
  name: string;
  status: string;
  instance_name: string;
}

export function useWhatsAppInstanceRealtime() {
  const queryClient = useQueryClient();
  const previousStatusRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    console.log('[useWhatsAppInstanceRealtime] 🔌 Iniciando subscription...');

    const channel = supabase
      .channel('whatsapp-instances-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_instances',
        },
        (payload) => {
          const instance = payload.new as WhatsAppInstanceChange;
          const oldInstance = payload.old as WhatsAppInstanceChange;
          
          console.log('[useWhatsAppInstanceRealtime] 📦 Mudança detectada:', {
            name: instance.name,
            oldStatus: oldInstance.status,
            newStatus: instance.status,
          });

          // Invalidar cache
          queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });

          // Detectar mudança de status
          const previousStatus = previousStatusRef.current.get(instance.id) || oldInstance.status;
          const currentStatus = instance.status;

          if (previousStatus !== currentStatus) {
            // Desconectou
            if (currentStatus === 'disconnected' || currentStatus === 'close') {
              toast.error(`WhatsApp "${instance.name}" desconectou`, {
                description: 'Clique para reconectar',
                duration: 10000,
                action: {
                  label: 'Configurar',
                  onClick: () => {
                    window.location.href = '/settings/whatsapp';
                  },
                },
              });
            }
            // Reconectou
            else if (currentStatus === 'open' && (previousStatus === 'disconnected' || previousStatus === 'close')) {
              toast.success(`WhatsApp "${instance.name}" reconectado`, {
                duration: 5000,
              });
            }
          }

          // Atualizar referência
          previousStatusRef.current.set(instance.id, currentStatus);
        }
      )
      .subscribe((status) => {
        console.log('[useWhatsAppInstanceRealtime] Status:', status);
      });

    return () => {
      console.log('[useWhatsAppInstanceRealtime] 🔌 Removendo subscription...');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
