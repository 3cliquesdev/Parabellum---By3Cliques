import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SupportChannel {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  created_at: string;
}

export function useSupportChannels() {
  return useQuery({
    queryKey: ["support-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_channels")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as SupportChannel[];
    },
  });
}
