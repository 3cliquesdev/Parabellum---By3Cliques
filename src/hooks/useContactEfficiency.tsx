import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

interface ContactEfficiencyStats {
  repId: string;
  repName: string;
  avgTouchesToConversion: number;
  emailsSent: number;
  callsMade: number;
  whatsappSent: number;
  totalWonDeals: number;
}

export function useContactEfficiency() {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["contact-efficiency", user?.id, role],
    queryFn: async () => {
      // Buscar deals ganhos
      let dealsQuery = supabase
        .from("deals")
        .select("id, contact_id, assigned_to, created_at, closed_at, profiles!deals_assigned_to_fkey(full_name)")
        .eq("status", "won")
        .not("contact_id", "is", null)
        .not("closed_at", "is", null);

      if (role === "sales_rep" && user?.id) {
        dealsQuery = dealsQuery.eq("assigned_to", user.id);
      }

      const { data: wonDeals, error: dealsError } = await dealsQuery;

      if (dealsError) throw dealsError;

      // Para cada deal, contar interações até o fechamento
      const repStats = new Map<string, {
        repName: string;
        totalTouches: number;
        emailsSent: number;
        callsMade: number;
        whatsappSent: number;
        dealsCount: number;
      }>();

      for (const deal of wonDeals || []) {
        const repId = deal.assigned_to || "unassigned";
        const repName = (deal.profiles as any)?.full_name || "Não atribuído";

        // Buscar interações do contato até a data de fechamento
        const { data: interactions } = await supabase
          .from("interactions")
          .select("type")
          .eq("customer_id", deal.contact_id)
          .lte("created_at", deal.closed_at);

        const touchTypes = ["email_sent", "call_incoming", "call_outgoing", "whatsapp_msg", "whatsapp_reply"];
        const touches = interactions?.filter(i => touchTypes.includes(i.type)) || [];
        
        const emailsSent = touches.filter(i => i.type === "email_sent").length;
        const callsMade = touches.filter(i => i.type === "call_incoming" || i.type === "call_outgoing").length;
        const whatsappSent = touches.filter(i => i.type === "whatsapp_msg" || i.type === "whatsapp_reply").length;

        if (!repStats.has(repId)) {
          repStats.set(repId, {
            repName,
            totalTouches: 0,
            emailsSent: 0,
            callsMade: 0,
            whatsappSent: 0,
            dealsCount: 0,
          });
        }

        const stats = repStats.get(repId)!;
        stats.totalTouches += touches.length;
        stats.emailsSent += emailsSent;
        stats.callsMade += callsMade;
        stats.whatsappSent += whatsappSent;
        stats.dealsCount += 1;
      }

      // Calcular médias
      const efficiency: ContactEfficiencyStats[] = Array.from(repStats.entries()).map(([repId, stats]) => ({
        repId,
        repName: stats.repName,
        avgTouchesToConversion: stats.totalTouches / stats.dealsCount,
        emailsSent: stats.emailsSent,
        callsMade: stats.callsMade,
        whatsappSent: stats.whatsappSent,
        totalWonDeals: stats.dealsCount,
      }));

      // Ordenar por eficiência (menos toques = melhor)
      return efficiency.sort((a, b) => a.avgTouchesToConversion - b.avgTouchesToConversion);
    },
  });
}
