import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useRealtimeHealth() {
  const [isConnected, setIsConnected] = useState(true);
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  const reconnectAttempts = useRef(0);
  const lastVisibilityChange = useRef<number>(Date.now());
  const healthChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Forçar refetch de dados - SEM destruir canais!
  const forceReconnect = useCallback(async () => {
    console.log('[RealtimeHealth] Forcing data refresh (NOT removing channels)...');
    
    // Apenas invalidar queries para refetch
    // NAO remover canais - cada hook gerencia o seu próprio canal
    queryClient.invalidateQueries({ queryKey: ['inbox-view'] });
    queryClient.invalidateQueries({ queryKey: ['messages'] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    
    reconnectAttempts.current = 0;
  }, [queryClient]);

  // Monitorar conexão com canal próprio de health check
  useEffect(() => {
    let pingInterval: NodeJS.Timeout;

    const setupHealthCheck = () => {
      // Remover apenas o canal de health anterior se existir
      if (healthChannelRef.current) {
        supabase.removeChannel(healthChannelRef.current);
        healthChannelRef.current = null;
      }

      const channel = supabase
        .channel('realtime-health-check')
        .on('presence', { event: 'sync' }, () => {
          setIsConnected(true);
          setLastPing(new Date());
        })
        .subscribe((status, err) => {
          console.log('[RealtimeHealth] Health channel status:', status, err);
          
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setLastPing(new Date());
            reconnectAttempts.current = 0;
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setIsConnected(false);
          }
        });

      healthChannelRef.current = channel;
    };

    setupHealthCheck();

    // Ping periódico - verifica APENAS o status geral, sem destruir canais
    pingInterval = setInterval(() => {
      const channels = supabase.getChannels();
      const joinedChannels = channels.filter(c => c.state === 'joined');
      
      console.log('[RealtimeHealth] Periodic check:', {
        totalChannels: channels.length,
        joinedChannels: joinedChannels.length,
        channelNames: channels.map(c => ({ topic: c.topic, state: c.state }))
      });
      
      if (joinedChannels.length === 0 && channels.length > 0) {
        console.log('[RealtimeHealth] No joined channels, may have connectivity issue');
        setIsConnected(false);
        
        // Apenas recriar o canal de health - NAO todos os canais
        if (reconnectAttempts.current < 5) {
          reconnectAttempts.current++;
          setupHealthCheck();
        }
      } else if (joinedChannels.length > 0) {
        setIsConnected(true);
        setLastPing(new Date());
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (healthChannelRef.current) {
        supabase.removeChannel(healthChannelRef.current);
        healthChannelRef.current = null;
      }
    };
  }, []); // Sem dependências - roda apenas uma vez

  // Reconectar quando tab volta ao foco
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        const timeSinceLastChange = Date.now() - lastVisibilityChange.current;
        
        // Se ficou mais de 2 minutos em background, forçar refresh de dados
        if (timeSinceLastChange > 120000) {
          console.log('[RealtimeHealth] Tab visible after long background, refreshing data');
          await forceReconnect();
        }
      }
      
      lastVisibilityChange.current = Date.now();
    };

    const handleOnline = () => {
      console.log('[RealtimeHealth] Browser came online, refreshing data');
      forceReconnect();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [forceReconnect]);

  return { isConnected, lastPing, forceReconnect };
}
