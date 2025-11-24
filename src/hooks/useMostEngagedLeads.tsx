import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

interface EngagedLead {
  customerId: string;
  customerName: string;
  interactionsCount: number;
  lastInteractionDate: string;
  dealTitle?: string;
  dealValue?: number;
  dealStage?: string;
}

export function useMostEngagedLeads() {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["most-engaged-leads", user?.id, role],
    queryFn: async () => {
      // Buscar interações dos últimos 7 dias
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      let query = supabase
        .from("interactions")
        .select(`
          customer_id,
          created_at,
          contacts!interactions_customer_id_fkey (
            id,
            first_name,
            last_name,
            assigned_to
          )
        `)
        .gte("created_at", sevenDaysAgo.toISOString());

      // Sales rep vê apenas seus contatos
      if (role === "sales_rep" && user?.id) {
        query = query.eq("contacts.assigned_to", user.id);
      }

      const { data: interactions, error } = await query;

      if (error) throw error;

      // Agrupar por customer_id
      const leadMap = new Map<string, {
        customerName: string;
        count: number;
        lastInteraction: string;
      }>();

      interactions?.forEach((interaction: any) => {
        const contact = interaction.contacts;
        if (!contact) return;

        const customerId = interaction.customer_id;
        const customerName = `${contact.first_name} ${contact.last_name}`;

        if (!leadMap.has(customerId)) {
          leadMap.set(customerId, {
            customerName,
            count: 0,
            lastInteraction: interaction.created_at,
          });
        }

        const existing = leadMap.get(customerId)!;
        existing.count += 1;

        if (new Date(interaction.created_at) > new Date(existing.lastInteraction)) {
          existing.lastInteraction = interaction.created_at;
        }
      });

      // Buscar deals relacionados para os leads
      const customerIds = Array.from(leadMap.keys());
      const { data: deals } = await supabase
        .from("deals")
        .select("contact_id, title, value, stage_id, stages(name)")
        .in("contact_id", customerIds)
        .eq("status", "open");

      const dealsMap = new Map(deals?.map(d => [d.contact_id, d]) || []);

      // Montar resultado final
      const engagedLeads: EngagedLead[] = Array.from(leadMap.entries()).map(([customerId, data]) => {
        const deal = dealsMap.get(customerId);
        
        return {
          customerId,
          customerName: data.customerName,
          interactionsCount: data.count,
          lastInteractionDate: data.lastInteraction,
          dealTitle: deal?.title,
          dealValue: deal?.value || undefined,
          dealStage: (deal?.stages as any)?.name,
        };
      });

      // Ordenar por quantidade de interações
      return engagedLeads
        .sort((a, b) => b.interactionsCount - a.interactionsCount)
        .slice(0, 10); // Top 10
    },
  });
}
