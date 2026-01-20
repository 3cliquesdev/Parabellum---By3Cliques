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

// Categories grouped by business channel
const SOURCE_CONFIG: Record<string, { label: string; color: string; category: string }> = {
  // Formulários (verde)
  formulario: { label: "Formulários", color: "#10B981", category: "formularios" },
  form: { label: "Formulários", color: "#10B981", category: "formularios" },
  webchat: { label: "Formulários", color: "#10B981", category: "formularios" },
  chat_widget: { label: "Formulários", color: "#10B981", category: "formularios" },
  
  // WhatsApp/Comercial (azul)
  whatsapp: { label: "WhatsApp/Comercial", color: "#3B82F6", category: "comercial" },
  manual: { label: "WhatsApp/Comercial", color: "#3B82F6", category: "comercial" },
  comercial: { label: "WhatsApp/Comercial", color: "#3B82F6", category: "comercial" },
  
  // Orgânico (roxo)
  kiwify_direto: { label: "Orgânico", color: "#8B5CF6", category: "organico" },
  kiwify_organic: { label: "Orgânico", color: "#8B5CF6", category: "organico" },
  
  // Afiliados/Parceiros (laranja)
  afiliado: { label: "Afiliados/Parceiros", color: "#F59E0B", category: "afiliados" },
  parceiro: { label: "Afiliados/Parceiros", color: "#F59E0B", category: "afiliados" },
  
  // Indicação (rosa)
  indicacao: { label: "Indicação", color: "#EC4899", category: "indicacao" },
  referral: { label: "Indicação", color: "#EC4899", category: "indicacao" },
  
  // Recorrência (ciano)
  kiwify_recorrencia: { label: "Recorrência", color: "#06B6D4", category: "recorrencia" },
  
  // Outros
  recuperacao: { label: "Recuperação", color: "#EF4444", category: "outros" },
  legado: { label: "Legado", color: "#9CA3AF", category: "outros" },
};

export function useLeadsBySource(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["leads-by-source", formatLocalDate(startDate), formatLocalDate(endDate)],
    queryFn: async (): Promise<LeadBySource[]> => {
      const startStr = `${formatLocalDate(startDate)}T00:00:00`;
      const endStr = `${formatLocalDate(endDate)}T23:59:59`;

      const { data: deals, error } = await supabase
        .from("deals")
        .select("lead_source, is_organic_sale, affiliate_name")
        .gte("created_at", startStr)
        .lte("created_at", endStr);

      if (error) throw error;

      // Count by CATEGORY - considera affiliate_name para classificar afiliados corretamente
      const categoryMap = new Map<string, { count: number; label: string; color: string }>();
      let total = 0;

      (deals || []).forEach((deal) => {
        const source = (deal.lead_source || "manual").toLowerCase();
        
        let config: { label: string; color: string; category: string };
        
        // PRIORIDADE 1: Fontes comerciais SEMPRE são WhatsApp/Comercial
        if (["whatsapp", "manual", "comercial", "webchat"].includes(source)) {
          config = { label: "WhatsApp/Comercial", color: "#3B82F6", category: "comercial" };
        }
        // PRIORIDADE 2: Afiliado só se tiver affiliate_name confirmado
        else if (deal.is_organic_sale === false && deal.affiliate_name) {
          config = { label: "Afiliados/Parceiros", color: "#F59E0B", category: "afiliados" };
        }
        // PRIORIDADE 3: Usar mapeamento padrão
        else {
          config = SOURCE_CONFIG[source] || {
            label: "Outros",
            color: "#6B7280",
            category: "outros",
          };
        }
        
        const existing = categoryMap.get(config.category) || {
          count: 0,
          label: config.label,
          color: config.color,
        };
        existing.count++;
        categoryMap.set(config.category, existing);
        total++;
      });

      // Convert to array with labels and colors
      const result: LeadBySource[] = Array.from(categoryMap.entries())
        .map(([category, data]) => ({
          source: category,
          label: data.label,
          count: data.count,
          percentage: total > 0 ? (data.count / total) * 100 : 0,
          color: data.color,
        }))
        .sort((a, b) => b.count - a.count);

      return result;
    },
    staleTime: 30 * 1000,
  });
}
