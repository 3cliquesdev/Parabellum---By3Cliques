import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConsultantPerformance {
  id: string;
  full_name: string;
  avatar_url: string | null;
  portfolio_count: number;
  portfolio_value: number;
  avg_health_score: number;
  last_activity: string | null;
}

export function useConsultantPerformance() {
  return useQuery({
    queryKey: ["consultant-performance"],
    queryFn: async () => {
      console.log("🔍 useConsultantPerformance: Fetching consultants...");
      
      // Fetch consultant user IDs first
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "consultant");

      if (rolesError) {
        console.error("❌ Error fetching consultant roles:", rolesError);
        throw rolesError;
      }

      const consultantIds = userRoles?.map(r => r.user_id) || [];
      console.log("✅ Found consultant IDs:", consultantIds);

      if (consultantIds.length === 0) {
        console.log("⚠️ No consultants found");
        return [];
      }

      // Fetch consultant profiles
      const { data: consultants, error: consultantsError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", consultantIds);

      if (consultantsError) {
        console.error("❌ Error fetching consultant profiles:", consultantsError);
        throw consultantsError;
      }

      console.log("✅ Found consultant profiles:", consultants?.length);

      // For each consultant, calculate their metrics
      const performanceData: ConsultantPerformance[] = await Promise.all(
        (consultants || []).map(async (consultant) => {
          // Contagem exata (sem limite de 1000)
          const { count, error: countError } = await supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("consultant_id", consultant.id)
            .eq("status", "customer");

          if (countError) throw countError;

          const portfolio_count = count || 0;

          // Dados para cálculos de value/health (amostra até 1000 é aceitável)
          const { data: portfolio, error: portfolioError } = await supabase
            .from("contacts")
            .select("subscription_plan, last_contact_date")
            .eq("consultant_id", consultant.id)
            .eq("status", "customer");

          if (portfolioError) throw portfolioError;

          // Calculate portfolio value
          const portfolio_value = portfolio?.reduce((sum, contact) => {
            const planValue = contact.subscription_plan?.match(/\d+/)?.[0];
            return sum + (planValue ? parseFloat(planValue) * 12 : 0);
          }, 0) || 0;

          // Calculate average health score
          const fourteenDaysAgo = new Date();
          fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          let healthScoreSum = 0;
          portfolio?.forEach((contact) => {
            if (!contact.last_contact_date) {
              healthScoreSum += 0; // Red = 0
            } else {
              const lastContact = new Date(contact.last_contact_date);
              if (lastContact < fourteenDaysAgo) {
                healthScoreSum += 0; // Red
              } else if (lastContact < sevenDaysAgo) {
                healthScoreSum += 1; // Yellow
              } else {
                healthScoreSum += 2; // Green
              }
            }
          });

          const avg_health_score = portfolio_count > 0 ? healthScoreSum / portfolio_count : 0;

          // Get last activity (last interaction created by this consultant)
          const { data: lastActivity } = await supabase
            .from("interactions")
            .select("created_at")
            .eq("created_by", consultant.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: consultant.id,
            full_name: consultant.full_name || "Sem nome",
            avatar_url: consultant.avatar_url,
            portfolio_count,
            portfolio_value,
            avg_health_score,
            last_activity: lastActivity?.created_at || null,
          };
        })
      );

      console.log("✅ Performance data calculated for", performanceData.length, "consultants");

      // Sort by portfolio value descending
      return performanceData.sort((a, b) => b.portfolio_value - a.portfolio_value);
    },
    staleTime: 1 * 60 * 1000, // Reduzido para 1 minuto para facilitar debug
    refetchOnMount: true, // Força refetch ao montar componente
  });
}
