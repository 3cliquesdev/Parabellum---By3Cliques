import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CSManagerKPIs {
  arrTotal: number;
  churnRateMonthly: number;
  upsellRevenue: number;
  healthDistribution: {
    green: number;
    yellow: number;
    red: number;
  };
}

export function useCSManagerKPIs() {
  return useQuery({
    queryKey: ["cs-manager-kpis"],
    queryFn: async () => {
      // Fetch all active customers
      const { data: customers, error: customersError } = await supabase
        .from("contacts")
        .select("*")
        .eq("status", "customer");

      if (customersError) throw customersError;

      // Calculate ARR (Annual Recurring Revenue)
      const arrTotal = customers?.reduce((sum, contact) => {
        const planValue = contact.subscription_plan?.match(/\d+/)?.[0];
        return sum + (planValue ? parseFloat(planValue) * 12 : 0);
      }, 0) || 0;

      // Calculate Churn Rate (customers lost this month)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: churnedCustomers, error: churnError } = await supabase
        .from("contacts")
        .select("id")
        .eq("status", "churned")
        .gte("created_at", startOfMonth.toISOString());

      if (churnError) throw churnError;

      const totalCustomers = customers?.length || 1;
      const churnedCount = churnedCustomers?.length || 0;
      const churnRateMonthly = (churnedCount / totalCustomers) * 100;

      // Calculate Upsell Revenue (deals won this month for existing customers)
      const { data: upsellDeals, error: upsellError } = await supabase
        .from("deals")
        .select("value")
        .eq("status", "won")
        .gte("closed_at", startOfMonth.toISOString());

      if (upsellError) throw upsellError;

      const upsellRevenue = upsellDeals?.reduce((sum, deal) => sum + (deal.value || 0), 0) || 0;

      // Calculate Health Distribution
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      let greenCount = 0;
      let yellowCount = 0;
      let redCount = 0;

      customers?.forEach((contact) => {
        if (!contact.last_contact_date) {
          redCount++;
        } else {
          const lastContact = new Date(contact.last_contact_date);
          if (lastContact < fourteenDaysAgo) {
            redCount++;
          } else if (lastContact < sevenDaysAgo) {
            yellowCount++;
          } else {
            greenCount++;
          }
        }
      });

      return {
        arrTotal,
        churnRateMonthly,
        upsellRevenue,
        healthDistribution: {
          green: greenCount,
          yellow: yellowCount,
          red: redCount,
        },
      } as CSManagerKPIs;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
