import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KiwifyFinancialData {
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalKiwifyFees: number;
  totalAffiliateCommissions: number;
  productBreakdown: Array<{
    productName: string;
    salesCount: number;
    grossRevenue: number;
    netRevenue: number;
    kiwifyFee: number;
    affiliateCommission: number;
    marginPercent: number;
  }>;
  monthlyEvolution: Array<{
    month: string;
    grossRevenue: number;
    netRevenue: number;
    kiwifyFee: number;
    affiliateCommission: number;
  }>;
  topAffiliates: Array<{
    affiliateName: string;
    affiliateEmail: string;
    salesCount: number;
    totalCommission: number;
  }>;
}

export function useKiwifyFinancials(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ["kiwify-financials", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      const start = startDate?.toISOString() || "2024-01-01";
      const end = endDate?.toISOString() || new Date().toISOString();

      console.log("📊 useKiwifyFinancials: Buscando dados financeiros", { start, end });

      // Buscar todos os deals Kiwify no período (incluindo recuperação e deals abertos)
      const { data: deals, error } = await supabase
        .from("deals")
        .select(`
          id,
          title,
          value,
          gross_value,
          net_value,
          kiwify_fee,
          affiliate_commission,
          affiliate_name,
          affiliate_email,
          status,
          created_at,
          closed_at,
          products:product_id (name)
        `)
        .in("status", ["won", "open"])
        .gte("created_at", start)
        .lte("created_at", end)
        .or("title.ilike.%Kiwify%,title.ilike.%Upsell%,title.ilike.%Recuperação%");

      if (error) {
        console.error("❌ useKiwifyFinancials: Erro ao buscar deals:", error);
        throw error;
      }

      console.log(`✅ useKiwifyFinancials: ${deals.length} deals encontrados`);

      // Calcular totais
      const totalGrossRevenue = deals.reduce((sum, d) => sum + (d.gross_value || d.value || 0), 0);
      const totalNetRevenue = deals.reduce((sum, d) => sum + (d.net_value || d.value * 0.7 || 0), 0);
      const totalKiwifyFees = deals.reduce((sum, d) => sum + (d.kiwify_fee || 0), 0);
      const totalAffiliateCommissions = deals.reduce((sum, d) => sum + (d.affiliate_commission || 0), 0);

      // Breakdown por produto
      const productMap = new Map<string, any>();
      deals.forEach(deal => {
        const productName = deal.products?.name || "Produto não identificado";
        if (!productMap.has(productName)) {
          productMap.set(productName, {
            productName,
            salesCount: 0,
            grossRevenue: 0,
            netRevenue: 0,
            kiwifyFee: 0,
            affiliateCommission: 0,
          });
        }
        const product = productMap.get(productName);
        product.salesCount++;
        product.grossRevenue += deal.gross_value || deal.value || 0;
        product.netRevenue += deal.net_value || deal.value * 0.7 || 0;
        product.kiwifyFee += deal.kiwify_fee || 0;
        product.affiliateCommission += deal.affiliate_commission || 0;
      });

      const productBreakdown = Array.from(productMap.values()).map(p => ({
        ...p,
        marginPercent: p.grossRevenue > 0 ? (p.netRevenue / p.grossRevenue) * 100 : 0,
      }));

      // Evolução mensal
      const monthMap = new Map<string, any>();
      deals.forEach(deal => {
        const month = new Date(deal.created_at).toISOString().slice(0, 7); // YYYY-MM
        if (!monthMap.has(month)) {
          monthMap.set(month, {
            month,
            grossRevenue: 0,
            netRevenue: 0,
            kiwifyFee: 0,
            affiliateCommission: 0,
          });
        }
        const monthData = monthMap.get(month);
        monthData.grossRevenue += deal.gross_value || deal.value || 0;
        monthData.netRevenue += deal.net_value || deal.value * 0.7 || 0;
        monthData.kiwifyFee += deal.kiwify_fee || 0;
        monthData.affiliateCommission += deal.affiliate_commission || 0;
      });

      const monthlyEvolution = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

      // Top Afiliados
      const affiliateMap = new Map<string, any>();
      deals.forEach(deal => {
        if (!deal.affiliate_name && !deal.affiliate_email) return;
        
        const key = deal.affiliate_email || deal.affiliate_name || "Sem identificação";
        if (!affiliateMap.has(key)) {
          affiliateMap.set(key, {
            affiliateName: deal.affiliate_name || "Nome não disponível",
            affiliateEmail: deal.affiliate_email || "Email não disponível",
            salesCount: 0,
            totalCommission: 0,
          });
        }
        const affiliate = affiliateMap.get(key);
        affiliate.salesCount++;
        affiliate.totalCommission += deal.affiliate_commission || 0;
      });

      const topAffiliates = Array.from(affiliateMap.values())
        .sort((a, b) => b.totalCommission - a.totalCommission);

      console.log("✅ useKiwifyFinancials: Dados calculados", {
        totalGrossRevenue,
        totalNetRevenue,
        productsCount: productBreakdown.length,
        affiliatesCount: topAffiliates.length,
      });

      return {
        totalGrossRevenue,
        totalNetRevenue,
        totalKiwifyFees,
        totalAffiliateCommissions,
        productBreakdown,
        monthlyEvolution,
        topAffiliates,
      } as KiwifyFinancialData;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
