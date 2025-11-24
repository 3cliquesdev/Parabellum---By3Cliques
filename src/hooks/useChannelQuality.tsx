import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

export interface ChannelQualityData {
  source: string;
  volume: number;
  avgTicket: number;
  totalRevenue: number;
}

export function useChannelQuality() {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["channel-quality", user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select(`
          value,
          assigned_to,
          contacts!deals_contact_id_fkey (
            source
          )
        `)
        .eq("status", "won")
        .not("value", "is", null);

      // Sales rep vê apenas seus próprios deals
      if (role === "sales_rep" && user?.id) {
        query = query.eq("assigned_to", user.id);
      }

      const { data: deals, error } = await query;

      if (error) throw error;

      // Agrupar por source
      const channelMap = new Map<string, { volume: number; totalRevenue: number }>();

      deals?.forEach((deal) => {
        const contact = deal.contacts as any;
        const source = contact?.source || "Desconhecido";
        const value = deal.value || 0;

        if (!channelMap.has(source)) {
          channelMap.set(source, { volume: 0, totalRevenue: 0 });
        }

        const channel = channelMap.get(source)!;
        channel.volume += 1;
        channel.totalRevenue += value;
      });

      // Converter para array e calcular ticket médio
      const channelQuality: ChannelQualityData[] = Array.from(
        channelMap.entries()
      ).map(([source, data]) => ({
        source,
        volume: data.volume,
        avgTicket: data.totalRevenue / data.volume,
        totalRevenue: data.totalRevenue,
      }));

      // Ordenar por receita total (maior primeiro)
      return channelQuality.sort((a, b) => b.totalRevenue - a.totalRevenue);
    },
  });
}
