import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface PresenceUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  is_typing: boolean;
}

export function useTicketPresence(ticketId: string | null) {
  const { user, profile } = useAuth();
  const [otherUsers, setOtherUsers] = useState<PresenceUser[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!ticketId || !user || !profile) return;

    const presenceChannel = supabase.channel(`ticket_presence:${ticketId}`);

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users: PresenceUser[] = [];

        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            // Não incluir o próprio usuário
            if (presence.user_id !== user.id) {
              users.push({
                user_id: presence.user_id,
                full_name: presence.full_name,
                avatar_url: presence.avatar_url,
                is_typing: presence.is_typing || false,
              });
            }
          });
        });

        setOtherUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user.id,
            full_name: profile.full_name || 'Agente',
            avatar_url: profile.avatar_url || null,
            is_typing: false,
            online_at: new Date().toISOString(),
          });
        }
      });

    setChannel(presenceChannel);

    return () => {
      presenceChannel.unsubscribe();
    };
  }, [ticketId, user, profile]);

  const setTyping = async (isTyping: boolean) => {
    if (!channel || !user || !profile) return;

    await channel.track({
      user_id: user.id,
      full_name: profile.full_name || 'Agente',
      avatar_url: profile.avatar_url || null,
      is_typing: isTyping,
      online_at: new Date().toISOString(),
    });
  };

  return {
    otherUsers,
    setTyping,
  };
}
