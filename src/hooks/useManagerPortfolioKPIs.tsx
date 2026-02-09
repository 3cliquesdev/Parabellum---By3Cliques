import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

export interface ManagerPortfolioKPIs {
  totalClients: number;
  totalRevenue: number;
  atRiskCount: number;
  newArrivalsCount: number;
}

export function useManagerPortfolioKPIs() {
  const { user } = useAuth();
  const { role, isAdmin, isManager, isCSManager } = useUserRole();

  const isGeneralManager = role === "general_manager";

  return useQuery({
    queryKey: ["manager-portfolio-kpis", user?.id, role],
    queryFn: async (): Promise<ManagerPortfolioKPIs> => {
      if (!user?.id) {
        return { totalClients: 0, totalRevenue: 0, atRiskCount: 0, newArrivalsCount: 0 };
      }

      console.log("📊 Calculating manager portfolio KPIs...");

      let contacts: any[] = [];

      if (isAdmin || isGeneralManager) {
        // Admin/general_manager: fetch ALL customers with a consultant
        const { data, error } = await supabase
          .from("contacts")
          .select("id, subscription_plan, last_contact_date, created_at")
          .eq("status", "customer")
          .not("consultant_id", "is", null);

        if (error) { console.error("❌ Error fetching contacts:", error); throw error; }
        contacts = data || [];
      } else {
        // Manager/cs_manager: filter by department
        const { data: profile } = await supabase
          .from("profiles")
          .select("department")
          .eq("id", user.id)
          .single();

        const dept = profile?.department;
        if (!dept) {
          console.log("⚠️ No department found for manager");
          return { totalClients: 0, totalRevenue: 0, atRiskCount: 0, newArrivalsCount: 0 };
        }

        const { data: consultants } = await supabase
          .from("profiles")
          .select("id")
          .eq("department", dept);

        const consultantIds = consultants?.map(c => c.id) || [];
        if (consultantIds.length === 0) {
          return { totalClients: 0, totalRevenue: 0, atRiskCount: 0, newArrivalsCount: 0 };
        }

        const { data, error } = await supabase
          .from("contacts")
          .select("id, subscription_plan, last_contact_date, created_at")
          .eq("status", "customer")
          .in("consultant_id", consultantIds);

        if (error) { console.error("❌ Error fetching contacts:", error); throw error; }
        contacts = data || [];
      }

      if (contacts.length === 0) {
        return { totalClients: 0, totalRevenue: 0, atRiskCount: 0, newArrivalsCount: 0 };
      }

      // Calculate total revenue from subscription plans
      const totalRevenue = contacts.reduce((sum, contact) => {
        const plan = contact.subscription_plan;
        if (!plan) return sum;
        const value = parseFloat(plan.replace(/[^\d,]/g, "").replace(",", "."));
        return sum + (isNaN(value) ? 0 : value);
      }, 0);

      // Count clients at risk (>30 days no contact)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const atRiskCount = contacts.filter((contact) => {
        if (!contact.last_contact_date) return true;
        return new Date(contact.last_contact_date) < thirtyDaysAgo;
      }).length;

      // Count new arrivals (created in last 7 days with completed onboarding)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentContacts = contacts.filter(c => new Date(c.created_at) >= sevenDaysAgo);
      let newArrivalsCount = 0;

      if (recentContacts.length > 0) {
        const recentIds = recentContacts.map(c => c.id);
        const { data: steps } = await supabase
          .from("customer_journey_steps")
          .select("contact_id, completed")
          .in("contact_id", recentIds);

        if (steps && steps.length > 0) {
          const grouped = new Map<string, boolean[]>();
          steps.forEach(s => {
            if (!grouped.has(s.contact_id)) grouped.set(s.contact_id, []);
            grouped.get(s.contact_id)!.push(s.completed);
          });
          grouped.forEach((completions) => {
            if (completions.length > 0 && completions.every(c => c)) {
              newArrivalsCount++;
            }
          });
        }
      }

      console.log(`✅ KPIs: ${contacts.length} clients, R$ ${totalRevenue.toFixed(2)} revenue, ${atRiskCount} at risk, ${newArrivalsCount} new`);

      return { totalClients: contacts.length, totalRevenue, atRiskCount, newArrivalsCount };
    },
    enabled: !!user?.id && (isAdmin || isGeneralManager || isManager || isCSManager),
    staleTime: 1000 * 60 * 2,
  });
}
