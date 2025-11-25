import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { differenceInDays } from "date-fns";

export interface ChurnRisk {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  current_health: "green" | "yellow" | "red";
  previous_health: "green" | "yellow" | "red";
  trend: "up" | "down" | "stable";
  days_since_contact: number;
  avg_days_between_contacts: number;
  reason: string;
}

export function useChurnPrediction() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["churn-prediction", user?.id],
    queryFn: async () => {
      if (!user) return [];

      console.log("⚠️ useChurnPrediction: Analyzing churn risks");

      // Buscar clientes do consultor
      const { data: contacts, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, company, phone, email, last_contact_date")
        .eq("consultant_id", user.id)
        .eq("status", "customer");

      if (error) {
        console.error("❌ Error fetching contacts:", error);
        throw error;
      }

      if (!contacts || contacts.length === 0) {
        return [];
      }

      const risks: ChurnRisk[] = [];

      for (const contact of contacts) {
        // Buscar histórico de interações
        const { data: interactions } = await supabase
          .from("interactions")
          .select("created_at")
          .eq("customer_id", contact.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (!interactions || interactions.length === 0) {
          // Sem histórico de interações - alto risco
          const daysSinceContact = contact.last_contact_date
            ? differenceInDays(new Date(), new Date(contact.last_contact_date))
            : 999;

          if (daysSinceContact > 14) {
            risks.push({
              id: contact.id,
              first_name: contact.first_name,
              last_name: contact.last_name,
              company: contact.company,
              phone: contact.phone,
              email: contact.email,
              current_health: "red",
              previous_health: "yellow",
              trend: "down",
              days_since_contact: daysSinceContact,
              avg_days_between_contacts: 0,
              reason: `Sem histórico de interações há ${daysSinceContact} dias. Cliente pode estar inativo.`,
            });
          }
          continue;
        }

        // Calcular média de dias entre contatos (últimas 5 interações)
        let totalDaysBetween = 0;
        let validGaps = 0;

        for (let i = 0; i < Math.min(interactions.length - 1, 4); i++) {
          const current = new Date(interactions[i].created_at);
          const previous = new Date(interactions[i + 1].created_at);
          const gap = differenceInDays(current, previous);
          if (gap > 0) {
            totalDaysBetween += gap;
            validGaps++;
          }
        }

        const avgDaysBetweenContacts = validGaps > 0 ? Math.round(totalDaysBetween / validGaps) : 7;

        // Calcular dias desde último contato
        const lastInteraction = new Date(interactions[0].created_at);
        const daysSinceContact = differenceInDays(new Date(), lastInteraction);

        // Determinar health scores atual e anterior
        let currentHealth: "green" | "yellow" | "red" = "green";
        if (daysSinceContact > 30) currentHealth = "red";
        else if (daysSinceContact > 7) currentHealth = "yellow";

        // Estimar health anterior baseado na média
        let previousHealth: "green" | "yellow" | "red" = "green";
        if (avgDaysBetweenContacts > 30) previousHealth = "red";
        else if (avgDaysBetweenContacts > 7) previousHealth = "yellow";

        // Detectar mudança de padrão (Early Warning)
        let trend: "up" | "down" | "stable" = "stable";
        let reason = "";

        // ↘️ Caindo: estava <7 dias (verde), agora >7 dias (amarelo/vermelho)
        if (previousHealth === "green" && currentHealth !== "green") {
          trend = "down";
          reason = `Cliente costumava ser contatado a cada ${avgDaysBetweenContacts} dias, mas está há ${daysSinceContact} dias sem contato.`;
        }
        // ↘️ Caindo: estava amarelo, agora vermelho
        else if (previousHealth === "yellow" && currentHealth === "red") {
          trend = "down";
          reason = `Saúde deteriorando: passou de ${daysSinceContact - 7} dias para ${daysSinceContact} dias sem contato.`;
        }
        // ↗️ Subindo: estava vermelho/amarelo, agora verde
        else if ((previousHealth === "red" || previousHealth === "yellow") && currentHealth === "green") {
          trend = "up";
          reason = `Recuperação: frequência de contato melhorou nos últimos dias.`;
        }
        // Verificação adicional: parou de logar (mudança brusca de padrão)
        else if (daysSinceContact > avgDaysBetweenContacts * 2 && currentHealth !== "green") {
          trend = "down";
          reason = `Cliente parou de logar: média de ${avgDaysBetweenContacts} dias, mas está há ${daysSinceContact} dias inativo.`;
        }

        // Adicionar apenas clientes com tendência descendente ou em risco
        if (trend === "down" || currentHealth === "red") {
          risks.push({
            id: contact.id,
            first_name: contact.first_name,
            last_name: contact.last_name,
            company: contact.company,
            phone: contact.phone,
            email: contact.email,
            current_health: currentHealth,
            previous_health: previousHealth,
            trend,
            days_since_contact: daysSinceContact,
            avg_days_between_contacts: avgDaysBetweenContacts,
            reason,
          });
        }
      }

      // Ordenar por prioridade (vermelho > amarelo, mais dias sem contato primeiro)
      const sorted = risks.sort((a, b) => {
        const healthPriority = { red: 3, yellow: 2, green: 1 };
        if (healthPriority[a.current_health] !== healthPriority[b.current_health]) {
          return healthPriority[b.current_health] - healthPriority[a.current_health];
        }
        return b.days_since_contact - a.days_since_contact;
      });

      console.log(`✅ Found ${sorted.length} churn risks`);
      return sorted;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
