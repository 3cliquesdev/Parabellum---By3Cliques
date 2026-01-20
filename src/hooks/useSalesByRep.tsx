import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

export function useSalesByRep(startDate?: Date, endDate?: Date) {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  return useQuery({
    queryKey: ["sales-by-rep", user?.id, role, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select("value, assigned_to, is_organic_sale, affiliate_commission, profiles!deals_assigned_to_fkey(full_name)")
        .eq("status", "won");

      // Aplicar filtro de data se fornecido
      if (startDate) {
        query = query.gte("closed_at", startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("closed_at", endOfDay.toISOString());
      }

      // Sales rep vê apenas seus próprios dados
      if (role === "sales_rep" && user?.id) {
        query = query.eq("assigned_to", user.id);
      }

      const { data: deals, error } = await query;

      if (error) throw error;

      // Agrupar por vendedor - separar vendas orgânicas e de afiliados
      const salesByRep = new Map<
        string,
        { repName: string; totalSales: number; dealsCount: number }
      >();

      deals?.forEach((deal) => {
        let repId: string;
        let repName: string;

        if (deal.assigned_to) {
          // Venda atribuída a um vendedor
          repId = deal.assigned_to;
          repName = (deal.profiles as any)?.full_name || "Vendedor";
        } else {
          // Venda sem vendedor - classificar por tipo
          const hasAffiliate = (deal.affiliate_commission || 0) > 0 || deal.is_organic_sale === false;
          if (hasAffiliate) {
            repId = "affiliate_sales";
            repName = "Vendas Afiliados";
          } else {
            repId = "organic_sales";
            repName = "Vendas Orgânicas";
          }
        }

        if (!salesByRep.has(repId)) {
          salesByRep.set(repId, {
            repName,
            totalSales: 0,
            dealsCount: 0,
          });
        }

        const rep = salesByRep.get(repId)!;
        rep.totalSales += deal.value || 0;
        rep.dealsCount += 1;
      });

      // Converter para array e ordenar por valor
      return Array.from(salesByRep.values()).sort(
        (a, b) => b.totalSales - a.totalSales
      );
    },
    enabled: !roleLoading,
  });
}
