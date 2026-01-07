import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface PresenceUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  viewing_ticket_id: string | null;
}

interface ViewingInfo {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

export function useTicketsPresence() {
  const { user, profile } = useAuth();
  const [viewingUsers, setViewingUsers] = useState<Map<string, ViewingInfo[]>>(new Map());
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [currentTicketId, setCurrentTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !profile) return;

    const presenceChannel = supabase.channel('tickets_presence_global');

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const ticketViewers = new Map<string, ViewingInfo[]>();

        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            // Não incluir o próprio usuário
            if (presence.user_id === user.id) return;
            
            const ticketId = presence.viewing_ticket_id;
            if (!ticketId) return;

            const existingViewers = ticketViewers.get(ticketId) || [];
            existingViewers.push({
              user_id: presence.user_id,
              full_name: presence.full_name,
              avatar_url: presence.avatar_url,
            });
            ticketViewers.set(ticketId, existingViewers);
          });
        });

        setViewingUsers(ticketViewers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user.id,
            full_name: profile.full_name || 'Agente',
            avatar_url: profile.avatar_url || null,
            viewing_ticket_id: null,
            online_at: new Date().toISOString(),
          });
        }
      });

    setChannel(presenceChannel);

    return () => {
      presenceChannel.unsubscribe();
    };
  }, [user, profile]);

  const setViewingTicket = useCallback(async (ticketId: string | null) => {
    if (!channel || !user || !profile) return;

    setCurrentTicketId(ticketId);
    
    await channel.track({
      user_id: user.id,
      full_name: profile.full_name || 'Agente',
      avatar_url: profile.avatar_url || null,
      viewing_ticket_id: ticketId,
      online_at: new Date().toISOString(),
    });
  }, [channel, user, profile]);

  const getViewersForTicket = useCallback((ticketId: string): ViewingInfo[] => {
    return viewingUsers.get(ticketId) || [];
  }, [viewingUsers]);

  return {
    viewingUsers,
    setViewingTicket,
    getViewersForTicket,
    currentTicketId,
  };
}
