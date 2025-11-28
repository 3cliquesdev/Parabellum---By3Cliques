import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

interface UseCadenceEnrollmentsOptions {
  cadenceId?: string;
  contactId?: string;
  status?: string;
}

export function useCadenceEnrollments({ cadenceId, contactId, status }: UseCadenceEnrollmentsOptions = {}) {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["cadence-enrollments", cadenceId, contactId, status, user?.id],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("cadence_enrollments")
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email, phone, company, assigned_to),
          cadence:cadences(id, name, description),
          enrolled_by_user:profiles!cadence_enrollments_enrolled_by_fkey(id, full_name, avatar_url)
        `)
        .order("created_at", { ascending: false });

      // Filter by cadence
      if (cadenceId) {
        query = query.eq("cadence_id", cadenceId);
      }

      // Filter by contact
      if (contactId) {
        query = query.eq("contact_id", contactId);
      }

      // Filter by status
      if (status) {
        query = query.eq("status", status);
      }

      // Sales rep only sees enrollments for their assigned contacts
      if (role === "sales_rep") {
        query = query.filter("contact.assigned_to", "eq", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}
