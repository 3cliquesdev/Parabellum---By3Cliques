import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useKiwifyStats() {
  return useQuery({
    queryKey: ["kiwify-stats"],
    queryFn: async () => {
      const [contactsResult, dealsResult] = await Promise.all([
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("source", "kiwify"),
        supabase
          .from("deals")
          .select("id", { count: "exact", head: true }),
      ]);

      return {
        contacts: contactsResult.count || 0,
        deals: dealsResult.count || 0,
      };
    },
  });
}
