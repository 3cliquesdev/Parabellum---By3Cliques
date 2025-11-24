import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

interface LeadScore {
  customerId: string;
  customerName: string;
  emailOpens: number;
  score: "hot" | "warm" | "cold";
  lastInteractionDate: string;
}

export function useLeadScoring() {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["lead-scoring", user?.id, role],
    queryFn: async () => {
      // Buscar interações dos últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let query = supabase
        .from("interactions")
        .select(`
          customer_id,
          type,
          created_at,
          contacts!interactions_customer_id_fkey (
            id,
            first_name,
            last_name,
            assigned_to
          )
        `)
        .gte("created_at", thirtyDaysAgo.toISOString());

      // Sales rep vê apenas seus contatos
      if (role === "sales_rep" && user?.id) {
        query = query.eq("contacts.assigned_to", user.id);
      }

      const { data: interactions, error } = await query;

      if (error) throw error;

      // Agrupar por customer_id e contar email_open
      const scoreMap = new Map<string, {
        customerName: string;
        emailOpens: number;
        lastInteraction: string;
      }>();

      interactions?.forEach((interaction: any) => {
        const contact = interaction.contacts;
        if (!contact) return;

        const customerId = interaction.customer_id;
        const customerName = `${contact.first_name} ${contact.last_name}`;

        if (!scoreMap.has(customerId)) {
          scoreMap.set(customerId, {
            customerName,
            emailOpens: 0,
            lastInteraction: interaction.created_at,
          });
        }

        const existing = scoreMap.get(customerId)!;
        
        if (interaction.type === "email_open") {
          existing.emailOpens += 1;
        }

        // Atualizar última interação se for mais recente
        if (new Date(interaction.created_at) > new Date(existing.lastInteraction)) {
          existing.lastInteraction = interaction.created_at;
        }
      });

      // Converter para array e classificar
      const leadScores: LeadScore[] = Array.from(scoreMap.entries()).map(([customerId, data]) => {
        let score: "hot" | "warm" | "cold" = "cold";
        if (data.emailOpens > 3) {
          score = "hot";
        } else if (data.emailOpens >= 2) {
          score = "warm";
        }

        return {
          customerId,
          customerName: data.customerName,
          emailOpens: data.emailOpens,
          score,
          lastInteractionDate: data.lastInteraction,
        };
      });

      // Ordenar por email opens (mais engajados primeiro)
      return leadScores.sort((a, b) => b.emailOpens - a.emailOpens);
    },
  });
}
