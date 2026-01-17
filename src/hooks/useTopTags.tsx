import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TopTag {
  id: string;
  name: string;
  color: string;
  count: number;
  percentage: number;
}

interface TicketsWithoutTagsInfo {
  count: number;
  total: number;
  percentage: number;
}

export interface UseTopTagsResult {
  topTags: TopTag[];
  ticketsWithoutTags: TicketsWithoutTagsInfo;
}

export function useTopTags(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['top-tags', startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<UseTopTagsResult> => {
      // Buscar tickets no período com suas tags
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          id,
          ticket_tags(
            tags(id, name, color)
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (ticketsError) throw ticketsError;

      const totalTickets = tickets?.length || 0;
      let ticketsWithTags = 0;
      
      // Contar ocorrências de cada tag
      const tagMap = new Map<string, { id: string; count: number; color: string }>();
      
      tickets?.forEach(ticket => {
        const ticketTags = ticket.ticket_tags as Array<{ tags: { id: string; name: string; color: string } | null }> | null;
        
        if (ticketTags && ticketTags.length > 0) {
          ticketsWithTags++;
          ticketTags.forEach(tt => {
            const tag = tt.tags;
            if (tag) {
              const existing = tagMap.get(tag.name) || { id: tag.id, count: 0, color: tag.color || '#6366f1' };
              tagMap.set(tag.name, { 
                id: tag.id,
                count: existing.count + 1, 
                color: tag.color || '#6366f1'
              });
            }
          });
        }
      });

      const totalTagOccurrences = Array.from(tagMap.values()).reduce((sum, t) => sum + t.count, 0);

      // Ordenar e retornar top 10
      const topTags: TopTag[] = Array.from(tagMap.entries())
        .map(([name, data]) => ({
          id: data.id,
          name,
          count: data.count,
          color: data.color,
          percentage: totalTagOccurrences > 0 ? (data.count / totalTagOccurrences) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const ticketsWithoutTagsCount = totalTickets - ticketsWithTags;

      return {
        topTags,
        ticketsWithoutTags: {
          count: ticketsWithoutTagsCount,
          total: totalTickets,
          percentage: totalTickets > 0 ? (ticketsWithoutTagsCount / totalTickets) * 100 : 0
        }
      };
    },
  });
}
