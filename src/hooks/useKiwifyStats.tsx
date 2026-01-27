import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useKiwifyStats() {
  return useQuery({
    queryKey: ["kiwify-stats"],
    queryFn: async () => {
      // Contar contatos que têm deals vinculados (independente do source)
      // e total de deals
      const [contactsWithDealsResult, dealsResult] = await Promise.all([
        supabase
          .from("deals")
          .select("contact_id", { count: "exact", head: true })
          .not("contact_id", "is", null),
        supabase
          .from("deals")
          .select("id", { count: "exact", head: true }),
      ]);

      return {
        contacts: contactsWithDealsResult.count || 0,
        deals: dealsResult.count || 0,
      };
    },
  });
}
