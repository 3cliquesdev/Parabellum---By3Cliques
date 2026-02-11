import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CS_NOVOS_PIPELINE_ID = "a7599c3b-2d55-4879-b5eb-303bc8266ea2";
const FIRST_EMAIL_NODE_ID = "1769519399023";
const SECOND_EMAIL_NODE_ID = "1769521501433";

export interface CSEmailFunnelData {
  totalSales: number;
  firstEmailDelivered: number;
  firstEmailDeliveredRate: number;
  secondEmailOpened: number;
  secondEmailOpenedRate: number;
}

export function useCSOnboardingEmailFunnel(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["cs-onboarding-email-funnel", startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<CSEmailFunnelData> => {
      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();

      // 1. Total deals in CS - Novos Clientes pipeline in date range
      const { count: totalSales, error: dealsError } = await supabase
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("pipeline_id", CS_NOVOS_PIPELINE_ID)
        .gte("created_at", startISO)
        .lte("created_at", endISO);

      if (dealsError) throw dealsError;

      // 2. First email delivered: email_sends with node 1 AND sent_at NOT NULL
      //    joined to deals via contact_id through playbook_executions
      const { data: firstEmailData, error: firstError } = await supabase
        .from("email_sends")
        .select(`
          id,
          contact_id,
          sent_at,
          playbook_execution_id
        `)
        .eq("playbook_node_id", FIRST_EMAIL_NODE_ID)
        .not("sent_at", "is", null)
        .gte("sent_at", startISO)
        .lte("sent_at", endISO);

      if (firstError) throw firstError;

      // Get unique contact_ids from first email sends
      const firstEmailContactIds = [...new Set((firstEmailData || []).map(e => e.contact_id).filter(Boolean))];

      // Cross-reference with deals in our pipeline
      let firstEmailDelivered = 0;
      if (firstEmailContactIds.length > 0) {
        const { count, error } = await supabase
          .from("deals")
          .select("id", { count: "exact", head: true })
          .eq("pipeline_id", CS_NOVOS_PIPELINE_ID)
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .in("contact_id", firstEmailContactIds);

        if (error) throw error;
        firstEmailDelivered = count || 0;
      }

      // 3. Second email opened: email_sends with node 2 AND opened_at NOT NULL
      const { data: secondEmailData, error: secondError } = await supabase
        .from("email_sends")
        .select(`
          id,
          contact_id,
          opened_at
        `)
        .eq("playbook_node_id", SECOND_EMAIL_NODE_ID)
        .not("opened_at", "is", null)
        .gte("opened_at", startISO)
        .lte("opened_at", endISO);

      if (secondError) throw secondError;

      const secondEmailContactIds = [...new Set((secondEmailData || []).map(e => e.contact_id).filter(Boolean))];

      let secondEmailOpened = 0;
      if (secondEmailContactIds.length > 0) {
        const { count, error } = await supabase
          .from("deals")
          .select("id", { count: "exact", head: true })
          .eq("pipeline_id", CS_NOVOS_PIPELINE_ID)
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .in("contact_id", secondEmailContactIds);

        if (error) throw error;
        secondEmailOpened = count || 0;
      }

      const total = totalSales || 0;

      return {
        totalSales: total,
        firstEmailDelivered,
        firstEmailDeliveredRate: total > 0 ? (firstEmailDelivered / total) * 100 : 0,
        secondEmailOpened,
        secondEmailOpenedRate: total > 0 ? (secondEmailOpened / total) * 100 : 0,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
