import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLTVStats(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ["ltv-stats", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select("total_ltv, status")
        .gt("total_ltv", 0);

      // Filter by last_payment_date if date range provided
      if (startDate) {
        query = query.gte("last_payment_date", startDate.toISOString());
      }
      if (endDate) {
        query = query.lte("last_payment_date", endDate.toISOString());
      }

      const { data: contacts, error } = await query;

      if (error) throw error;

      const totalCustomers = contacts.length;
      const avgLTV = totalCustomers > 0 
        ? contacts.reduce((sum, c) => sum + (c.total_ltv || 0), 0) / totalCustomers 
        : 0;
      const totalLTV = contacts.reduce((sum, c) => sum + (c.total_ltv || 0), 0);
      
      const ltvByStatus = {
        customer: contacts
          .filter(c => c.status === 'customer')
          .reduce((sum, c) => sum + (c.total_ltv || 0), 0),
        qualified: contacts
          .filter(c => c.status === 'qualified')
          .reduce((sum, c) => sum + (c.total_ltv || 0), 0),
        lead: contacts
          .filter(c => c.status === 'lead')
          .reduce((sum, c) => sum + (c.total_ltv || 0), 0),
      };

      return { avgLTV, totalLTV, totalCustomers, ltvByStatus };
    },
  });
}
