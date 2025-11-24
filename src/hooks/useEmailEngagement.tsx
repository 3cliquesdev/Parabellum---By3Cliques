import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

interface EmailEngagementStats {
  repId: string;
  repName: string;
  emailsSent: number;
  emailsOpened: number;
  openRate: number;
}

export function useEmailEngagement() {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["email-engagement", user?.id, role],
    queryFn: async () => {
      // Buscar interações de email dos últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let query = supabase
        .from("interactions")
        .select(`
          type,
          created_by,
          profiles!interactions_created_by_fkey(full_name)
        `)
        .in("type", ["email_sent", "email_open"])
        .gte("created_at", thirtyDaysAgo.toISOString())
        .not("created_by", "is", null);

      // Sales rep vê apenas suas interações
      if (role === "sales_rep" && user?.id) {
        query = query.eq("created_by", user.id);
      }

      const { data: interactions, error } = await query;

      if (error) throw error;

      // Agrupar por vendedor
      const repMap = new Map<string, {
        repName: string;
        sent: number;
        opened: number;
      }>();

      interactions?.forEach((interaction: any) => {
        const repId = interaction.created_by || "unknown";
        const repName = interaction.profiles?.full_name || "Desconhecido";

        if (!repMap.has(repId)) {
          repMap.set(repId, {
            repName,
            sent: 0,
            opened: 0,
          });
        }

        const stats = repMap.get(repId)!;
        if (interaction.type === "email_sent") {
          stats.sent += 1;
        } else if (interaction.type === "email_open") {
          stats.opened += 1;
        }
      });

      // Calcular taxas de abertura
      const engagement: EmailEngagementStats[] = Array.from(repMap.entries())
        .map(([repId, stats]) => ({
          repId,
          repName: stats.repName,
          emailsSent: stats.sent,
          emailsOpened: stats.opened,
          openRate: stats.sent > 0 ? (stats.opened / stats.sent) * 100 : 0,
        }))
        .filter(stat => stat.emailsSent > 0); // Apenas vendedores que enviaram emails

      // Ordenar por taxa de abertura
      return engagement.sort((a, b) => b.openRate - a.openRate);
    },
  });
}
