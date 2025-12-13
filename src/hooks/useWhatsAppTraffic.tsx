import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppTrafficData {
  hour: string;
  sent: number;
  received: number;
}

export function useWhatsAppTraffic(startDate: Date, endDate: Date) {
  // Ajustar datas para início e fim do dia no timezone local
  const adjustedStartDate = new Date(startDate);
  adjustedStartDate.setHours(0, 0, 0, 0);
  
  const adjustedEndDate = new Date(endDate);
  adjustedEndDate.setHours(23, 59, 59, 999);

  return useQuery({
    queryKey: ['whatsapp-traffic', adjustedStartDate.toISOString(), adjustedEndDate.toISOString()],
    queryFn: async (): Promise<WhatsAppTrafficData[]> => {
      // Primeiro, buscar IDs de conversas do canal WhatsApp
      const { data: whatsappConversations, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('channel', 'whatsapp');

      if (convError) throw convError;

      const conversationIds = whatsappConversations?.map(c => c.id) || [];
      
      if (conversationIds.length === 0) {
        return [];
      }

      // Buscar mensagens apenas dessas conversas WhatsApp
      const { data: messages, error } = await supabase
        .from('messages')
        .select('created_at, sender_type, conversation_id')
        .in('conversation_id', conversationIds)
        .gte('created_at', adjustedStartDate.toISOString())
        .lte('created_at', adjustedEndDate.toISOString());

      if (error) throw error;

      // Group messages by hour
      const hourlyMap = new Map<string, { sent: number; received: number }>();

      messages?.forEach((msg) => {
        const date = new Date(msg.created_at);
        const hourKey = `${date.getHours().toString().padStart(2, '0')}:00`;

        if (!hourlyMap.has(hourKey)) {
          hourlyMap.set(hourKey, { sent: 0, received: 0 });
        }

        const stats = hourlyMap.get(hourKey)!;
        
        // User/system messages are "sent", contact messages are "received"
        if (msg.sender_type === 'user' || msg.sender_type === 'system') {
          stats.sent += 1;
        } else {
          stats.received += 1;
        }
      });

      // Convert to array and sort by hour
      const traffic: WhatsAppTrafficData[] = Array.from(hourlyMap.entries())
        .map(([hour, stats]) => ({
          hour,
          sent: stats.sent,
          received: stats.received
        }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      return traffic;
    },
  });
}
