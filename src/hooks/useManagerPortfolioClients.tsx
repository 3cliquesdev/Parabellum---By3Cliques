import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

export interface ManagerPortfolioClient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  whatsapp_id: string | null;
  avatar_url: string | null;
  subscription_plan: string | null;
  company: string | null;
  consultant_id: string | null;
  consultant_name: string | null;
  consultant_avatar: string | null;
  last_contact_date: string | null;
  seller_name: string | null;
  seller_avatar: string | null;
  total_steps: number;
  completed_steps: number;
  critical_pending: number;
  onboarding_progress: number;
  is_new_client: boolean;
  health_score: "green" | "yellow" | "red";
}

export function useManagerPortfolioClients() {
  const { user } = useAuth();
  const { role, isAdmin, isManager, isCSManager } = useUserRole();

  return useQuery({
    queryKey: ["manager-portfolio-clients", user?.id, role],
    queryFn: async () => {
      if (!user?.id) return [];

      console.log("📊 Fetching manager portfolio clients...");

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
        .select("id, full_name, avatar_url, department")
        .or("id.in.(select consultant_id from contacts where consultant_id is not null)");

      if (departmentFilter && !isAdmin) {
        consultantsQuery = consultantsQuery.eq("department", departmentFilter);
      }

      const { data: consultants, error: consultantsError } = await consultantsQuery;

      if (consultantsError) {
        console.error("❌ Error fetching consultants:", consultantsError);
        throw consultantsError;
      }

      const consultantIds = consultants?.map(c => c.id) || [];

      if (consultantIds.length === 0) {
        console.log("⚠️ No consultants found in department");
        return [];
      }

      // Fetch all customers assigned to these consultants
      const { data: contacts, error: contactsError } = await supabase
        .from("contacts")
        .select("*")
        .eq("status", "customer")
        .in("consultant_id", consultantIds)
        .order("created_at", { ascending: false });

      if (contactsError) {
        console.error("❌ Error fetching contacts:", contactsError);
        throw contactsError;
      }

      if (!contacts || contacts.length === 0) {
        console.log("⚠️ No customers found for consultants");
        return [];
      }

      console.log(`✅ Found ${contacts.length} customers across ${consultants.length} consultants`);

      // Process each contact with journey steps and consultant info
      const clientsWithDetails = await Promise.all(
        contacts.map(async (contact) => {
          // Fetch journey steps for onboarding progress
          const { data: steps } = await supabase
            .from("customer_journey_steps")
            .select("*")
            .eq("contact_id", contact.id);

          const total_steps = steps?.length || 0;
          const completed_steps = steps?.filter(s => s.completed).length || 0;
          const critical_pending = steps?.filter(s => s.is_critical && !s.completed).length || 0;
          const onboarding_progress = total_steps > 0 ? (completed_steps / total_steps) * 100 : 0;

          // Check if new client (created in last 7 days)
          const createdDate = new Date(contact.created_at);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const is_new_client = createdDate >= sevenDaysAgo;

          // Calculate health score based on last contact
          let health_score: "green" | "yellow" | "red" = "green";
          if (contact.last_contact_date) {
            const lastContact = new Date(contact.last_contact_date);
            const daysSinceContact = Math.floor((Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysSinceContact > 30) {
              health_score = "red";
            } else if (daysSinceContact > 15) {
              health_score = "yellow";
            }
          }

          // Get consultant info
          const consultant = consultants.find(c => c.id === contact.consultant_id);

          // Get seller info
          let seller_name = null;
          let seller_avatar = null;
          if (contact.assigned_to) {
            const { data: seller } = await supabase
              .from("profiles")
              .select("full_name, avatar_url")
              .eq("id", contact.assigned_to)
              .single();
            
            seller_name = seller?.full_name || null;
            seller_avatar = seller?.avatar_url || null;
          }

          return {
            id: contact.id,
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email,
            phone: contact.phone,
            whatsapp_id: contact.whatsapp_id,
            avatar_url: contact.avatar_url,
            subscription_plan: contact.subscription_plan,
            company: contact.company,
            consultant_id: contact.consultant_id,
            consultant_name: consultant?.full_name || null,
            consultant_avatar: consultant?.avatar_url || null,
            last_contact_date: contact.last_contact_date,
            seller_name,
            seller_avatar,
            total_steps,
            completed_steps,
            critical_pending,
            onboarding_progress,
            is_new_client,
            health_score,
          };
        })
      );

      return clientsWithDetails;
    },
    enabled: !!user?.id && (isAdmin || isManager || isCSManager),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
