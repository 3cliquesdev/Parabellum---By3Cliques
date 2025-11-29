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

  return useQuery({
    queryKey: ["manager-portfolio-kpis", user?.id, role],
    queryFn: async (): Promise<ManagerPortfolioKPIs> => {
      if (!user?.id) {
        return {
          totalClients: 0,
          totalRevenue: 0,
          atRiskCount: 0,
          newArrivalsCount: 0,
        };
      }

      console.log("📊 Calculating manager portfolio KPIs...");

      // For managers, get their department
      let departmentFilter = null;
      if (isManager || isCSManager) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("department")
          .eq("id", user.id)
          .single();
        
        departmentFilter = profile?.department;
      }

      // Fetch all consultants in the manager's department (or all for admins)
      let consultantsQuery = supabase
        .from("profiles")
        .select("id")
        .or("id.in.(select consultant_id from contacts where consultant_id is not null)");

      if (departmentFilter && !isAdmin) {
        consultantsQuery = consultantsQuery.eq("department", departmentFilter);
      }

      const { data: consultants } = await consultantsQuery;
      const consultantIds = consultants?.map(c => c.id) || [];

      if (consultantIds.length === 0) {
        console.log("⚠️ No consultants found in department");
        return {
          totalClients: 0,
          totalRevenue: 0,
          atRiskCount: 0,
          newArrivalsCount: 0,
        };
      }

      // Fetch all customers for these consultants
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, subscription_plan, last_contact_date, created_at")
        .eq("status", "customer")
        .in("consultant_id", consultantIds);

      if (!contacts || contacts.length === 0) {
        return {
          totalClients: 0,
          totalRevenue: 0,
          atRiskCount: 0,
          newArrivalsCount: 0,
        };
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
      
      const newArrivalsCount = await contacts.reduce(async (accPromise, contact) => {
        const acc = await accPromise;
        const createdDate = new Date(contact.created_at);
        if (createdDate < sevenDaysAgo) return acc;

        // Check if onboarding is completed
        const { data: steps } = await supabase
          .from("customer_journey_steps")
          .select("completed")
          .eq("contact_id", contact.id);

        if (steps && steps.length > 0 && steps.every(s => s.completed)) {
          return acc + 1;
        }
        return acc;
      }, Promise.resolve(0));

      console.log(`✅ KPIs: ${contacts.length} clients, R$ ${totalRevenue.toFixed(2)} revenue, ${atRiskCount} at risk, ${newArrivalsCount} new`);

      return {
        totalClients: contacts.length,
        totalRevenue,
        atRiskCount,
        newArrivalsCount,
      };
    },
    enabled: !!user?.id && (isAdmin || isManager || isCSManager),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
