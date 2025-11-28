import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppTrafficData {
  hour: string;
  sent: number;
  received: number;
}

export function useWhatsAppTraffic(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['whatsapp-traffic'],
    queryFn: async () => {
      const traffic: WhatsAppTrafficData[] = [];
      return traffic;
    },
  });
}
