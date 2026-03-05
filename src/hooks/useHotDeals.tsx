import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

export function useHotDeals() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  return useQuery({
    queryKey: ["hot-deals", user?.id, role],
    queryFn: async () => {
      // Buscar deals abertos com fechamento previsto nos próximos 7 dias
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(today.getDate() + 7);
      sevenDaysFromNow.setHours(23, 59, 59, 999);

      let query = supabase
        .from("deals")
        .select(
          `
          id,
          title,
          value,
          expected_close_date,
          contacts!deals_contact_id_fkey(first_name, last_name),
          organizations(name),
          stages(name),
          profiles!deals_assigned_to_fkey(full_name)
        `
        )
        .eq("status", "open")
        .not("expected_close_date", "is", null)
        .gte("expected_close_date", today.toISOString().split("T")[0])
        .lte("expected_close_date", sevenDaysFromNow.toISOString().split("T")[0])
        .order("value", { ascending: false })
        .limit(5);

      // Sales rep vê apenas seus próprios dados
      if (role === "sales_rep" && user?.id) {
        query = query.eq("assigned_to", user.id);
      }

      const { data: deals, error } = await query;

      if (error) throw error;

      return deals || [];
    },
    enabled: !roleLoading,
  });
}
