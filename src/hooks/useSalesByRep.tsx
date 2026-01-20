import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";
import { formatLocalDate, getDateTimeBoundaries } from "@/lib/dateUtils";

export function useSalesByRep(startDate?: Date, endDate?: Date) {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  // Gerar chaves estáveis baseadas em data local (YYYY-MM-DD) para evitar problemas de timezone
  const startKey = startDate ? formatLocalDate(startDate) : undefined;
  const endKey = endDate ? formatLocalDate(endDate) : undefined;

  return useQuery({
    queryKey: ["sales-by-rep", user?.id, role, startKey, endKey],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select("value, assigned_to, is_organic_sale, affiliate_commission, affiliate_name, lead_source, title, profiles!deals_assigned_to_fkey(full_name)")
        .eq("status", "won");

      // Aplicar filtro de data usando boundaries locais (timezone-safe)
      if (startDate && endDate) {
        const { startDateTime, endDateTime } = getDateTimeBoundaries(startDate, endDate);
        query = query.gte("closed_at", startDateTime).lte("closed_at", endDateTime);
      } else if (startDate) {
        query = query.gte("closed_at", `${formatLocalDate(startDate)}T00:00:00`);
      } else if (endDate) {
        query = query.lte("closed_at", `${formatLocalDate(endDate)}T23:59:59`);
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
          // Venda sem vendedor - classificar por tipo usando lógica de prioridade unificada
          const source = (deal as any).lead_source?.toLowerCase().trim();
          const title = (deal as any).title?.toLowerCase() || "";
          
          // PRIORIDADE 1: Fontes comerciais → Comercial (Não atribuído)
          if (source && ["whatsapp", "manual", "comercial", "webchat"].includes(source)) {
            repId = "commercial_unassigned";
            repName = "Comercial (Não atribuído)";
          }
          // PRIORIDADE 2: Recuperação (título começa com "Recuperação")
          else if (title.startsWith("recuperação") || title.startsWith("recuperacao")) {
            repId = "recovery_sales";
            repName = "Recuperação";
          }
          // PRIORIDADE 3: Afiliado só se tiver affiliate_name confirmado
          else if (deal.is_organic_sale === false && (deal as any).affiliate_name) {
            repId = "affiliate_sales";
            repName = "Vendas Afiliados";
          }
          // PRIORIDADE 4: Demais vendas sem vendedor são orgânicas
          else {
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
