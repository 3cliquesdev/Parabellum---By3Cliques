import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useRealtimeHealth() {
  const [isConnected, setIsConnected] = useState(true);
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  const reconnectAttempts = useRef(0);
  const lastVisibilityChange = useRef<number>(Date.now());

  // Forçar reconexão de todos os canais
  const forceReconnect = useCallback(async () => {
    console.log('[RealtimeHealth] Forcing reconnection of all channels...');
    
    try {
      // Remover todos os canais existentes
      const channels = supabase.getChannels();
      for (const channel of channels) {
        await supabase.removeChannel(channel);
      }
      
      // Invalidar queries críticas para forçar refetch
      queryClient.invalidateQueries({ queryKey: ['inbox-view'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      
      console.log('[RealtimeHealth] All channels removed, queries invalidated');
      reconnectAttempts.current = 0;
    } catch (e) {
      console.error('[RealtimeHealth] Force reconnect error:', e);
      reconnectAttempts.current++;
    }
  }, [queryClient]);

  // Monitorar conexão com canal de health check
  useEffect(() => {
    let pingInterval: NodeJS.Timeout;
    let healthChannel: ReturnType<typeof supabase.channel>;

    const setupHealthCheck = () => {
      healthChannel = supabase
        .channel('realtime-health-check', {
          config: {
            presence: { key: 'health' },
          },
        })
        .on('system', { event: '*' }, (payload) => {
          console.log('[RealtimeHealth] System event:', payload);
        })
        .subscribe((status, err) => {
          console.log('[RealtimeHealth] Subscription status:', status, err);
          
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setLastPing(new Date());
            reconnectAttempts.current = 0;
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setIsConnected(false);
            
            // Tentar reconectar após delay exponencial
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
            console.log(`[RealtimeHealth] Will retry in ${delay}ms`);
            
            setTimeout(() => {
              reconnectAttempts.current++;
              forceReconnect();
            }, delay);
          }
        });
    };

    setupHealthCheck();

    // Ping periódico para verificar se conexão está viva
    pingInterval = setInterval(() => {
      const channels = supabase.getChannels();
      const healthCh = channels.find(c => c.topic === 'realtime:realtime-health-check');
      
      if (!healthCh || healthCh.state !== 'joined') {
        console.log('[RealtimeHealth] Health channel not joined, status:', healthCh?.state);
        setIsConnected(false);
        
        // Se perdeu conexão, forçar reconexão
        if (reconnectAttempts.current < 5) {
          forceReconnect();
        }
      } else {
        setIsConnected(true);
        setLastPing(new Date());
      }
    }, 30000); // Verificar a cada 30s

    return () => {
      clearInterval(pingInterval);
      if (healthChannel) {
        supabase.removeChannel(healthChannel);
      }
    };
  }, [forceReconnect]);

  // Reconectar quando tab volta ao foco após tempo inativo
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        const timeSinceLastChange = Date.now() - lastVisibilityChange.current;
        
        // Se ficou mais de 2 minutos em background, forçar refresh
        if (timeSinceLastChange > 120000) {
          console.log('[RealtimeHealth] Tab visible after long background, forcing refresh');
          await forceReconnect();
        } else if (!isConnected) {
          console.log('[RealtimeHealth] Tab visible but disconnected, forcing refresh');
          await forceReconnect();
        }
      }
      
      lastVisibilityChange.current = Date.now();
    };

    // Também reconectar quando internet volta
    const handleOnline = () => {
      console.log('[RealtimeHealth] Browser came online, forcing reconnect');
      forceReconnect();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [isConnected, forceReconnect]);

  return { isConnected, lastPing, forceReconnect };
}
