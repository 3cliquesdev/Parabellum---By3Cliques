/**
 * Hook para breakdown de vendas ganhas por tipo e canal
 * - Comercial: vendas com vendedor atribuído (assigned_to IS NOT NULL)
 * - Automático: vendas sem vendedor (orgânico/afiliado/recorrência)
 * - Novas: primeira venda do deal
 * - Recorrências: identificadas por lead_source contendo 'recorr' ou 'renova'
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDateTimeBoundaries, formatLocalDate } from "@/lib/dateUtils";

export interface SalesBreakdown {
  comercial: number;
  automatico: number;
  novas: number;
  recorrencias: number;
}

export function useSalesBreakdown(startDate: Date | undefined, endDate: Date | undefined) {
  return useQuery({
    queryKey: [
      "sales-breakdown",
      startDate ? formatLocalDate(startDate) : null,
      endDate ? formatLocalDate(endDate) : null,
    ],
    enabled: !!startDate && !!endDate,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<SalesBreakdown> => {
      if (!startDate || !endDate) {
        return { comercial: 0, automatico: 0, novas: 0, recorrencias: 0 };
      }

      const { startDateTime, endDateTime } = getDateTimeBoundaries(startDate, endDate);

      // Buscar todos os deals ganhos no período com dados necessários
      const { data: wonDeals, error } = await supabase
        .from("deals")
        .select("id, assigned_to, lead_source, title")
        .eq("status", "won")
        .gte("closed_at", startDateTime)
        .lte("closed_at", endDateTime);

      if (error) {
        console.error("❌ useSalesBreakdown error:", error);
        throw error;
      }

      const deals = wonDeals || [];
      
      let comercial = 0;
      let automatico = 0;
      let novas = 0;
      let recorrencias = 0;

      deals.forEach((deal) => {
        // Classificação por canal
        if (deal.assigned_to) {
          comercial++;
        } else {
          automatico++;
        }

        // Classificação por tipo (nova vs recorrência)
        const leadSource = (deal.lead_source || "").toLowerCase();
        const title = (deal.title || "").toLowerCase();
        
        const isRecorrencia = 
          leadSource.includes("recorr") ||
          leadSource.includes("renova") ||
          leadSource.includes("kiwify_recorrencia") ||
          title.includes("renovação") ||
          title.includes("recorrência");

        if (isRecorrencia) {
          recorrencias++;
        } else {
          novas++;
        }
      });

      const breakdown = { comercial, automatico, novas, recorrencias };
      
      console.log("📊 useSalesBreakdown:", breakdown);

      return breakdown;
    },
  });
}
