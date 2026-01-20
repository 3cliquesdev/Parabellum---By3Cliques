import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatLocalDate } from "@/lib/dateUtils";

export interface LeadBySource {
  source: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  manual: { label: "Manual", color: "hsl(var(--chart-1))" },
  formulario: { label: "Formulário", color: "hsl(var(--chart-2))" },
  form: { label: "Formulário", color: "hsl(var(--chart-2))" },
  whatsapp: { label: "WhatsApp", color: "hsl(var(--chart-3))" },
  chat_widget: { label: "Chat Web", color: "hsl(var(--chart-4))" },
  webchat: { label: "Chat Web", color: "hsl(var(--chart-4))" },
  indicacao: { label: "Indicação", color: "hsl(var(--chart-5))" },
  referral: { label: "Indicação", color: "hsl(var(--chart-5))" },
  kiwify_organic: { label: "Kiwify Orgânico", color: "#10B981" },
  kiwify_direto: { label: "Kiwify Direto", color: "#059669" },
  kiwify_recorrencia: { label: "Kiwify Recorrência", color: "#14B8A6" },
  recuperacao: { label: "Recuperação", color: "#EF4444" },
  legado: { label: "Legado", color: "#9CA3AF" },
};

export function useLeadsBySource(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["leads-by-source", formatLocalDate(startDate), formatLocalDate(endDate)],
    queryFn: async (): Promise<LeadBySource[]> => {
      const startStr = `${formatLocalDate(startDate)}T00:00:00`;
      const endStr = `${formatLocalDate(endDate)}T23:59:59`;

      const { data: deals, error } = await supabase
        .from("deals")
        .select("lead_source")
        .gte("created_at", startStr)
        .lte("created_at", endStr);

      if (error) throw error;

      // Count by source
      const sourceMap = new Map<string, number>();
      let total = 0;

      (deals || []).forEach((deal) => {
        const source = deal.lead_source || "manual";
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
        total++;
      });

      // Convert to array with labels and colors
      const result: LeadBySource[] = Array.from(sourceMap.entries())
        .map(([source, count]) => {
          const config = SOURCE_CONFIG[source.toLowerCase()] || {
            label: source.charAt(0).toUpperCase() + source.slice(1),
            color: "#6B7280",
          };
          return {
            source,
            label: config.label,
            count,
            percentage: total > 0 ? (count / total) * 100 : 0,
            color: config.color,
          };
        })
        .sort((a, b) => b.count - a.count);

      return result;
    },
    staleTime: 30 * 1000,
  });
}
