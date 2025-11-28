import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCadences() {
  return useQuery({
    queryKey: ["cadences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cadences")
        .select(`
          *,
          created_by_user:profiles!cadences_created_by_fkey(id, full_name, avatar_url)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}
