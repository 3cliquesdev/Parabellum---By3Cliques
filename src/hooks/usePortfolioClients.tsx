import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PortfolioClient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  subscription_plan: string | null;
  last_contact_date: string | null;
  consultant_assigned_at: string | null;
  seller_name: string | null;
  seller_avatar: string | null;
  total_steps: number;
  completed_steps: number;
  critical_pending: number;
  onboarding_progress: number;
  is_new_client: boolean;
  health_score: "green" | "yellow" | "red";
  status: string | null;
}

export function usePortfolioClients() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["portfolio-clients", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch contacts assigned to current consultant
      const { data: contacts, error } = await supabase
        .from("contacts")
        .select(`
          *,
          assigned_to_profile:profiles!contacts_assigned_to_fkey(full_name, avatar_url)
        `)
        .eq("consultant_id", user.id)
        .eq("status", "customer")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // For each contact, fetch journey steps
      const portfolioClients: PortfolioClient[] = await Promise.all(
        (contacts || []).map(async (contact) => {
          const { data: steps } = await supabase
            .from("customer_journey_steps")
            .select("id, completed, is_critical")
            .eq("contact_id", contact.id);

          const totalSteps = steps?.length || 0;
          const completedSteps = steps?.filter(s => s.completed).length || 0;
          const criticalPending = steps?.filter(s => s.is_critical && !s.completed).length || 0;
          const onboardingProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 100;

          // Calculate if client is new (created < 7 days ago as proxy)
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const isNewClient = contact.created_at && new Date(contact.created_at) > sevenDaysAgo;

          // Calculate health score based on last_contact_date
          let healthScore: "green" | "yellow" | "red" = "green";
          if (contact.last_contact_date) {
            const lastContact = new Date(contact.last_contact_date);
            const daysSinceContact = Math.floor((Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysSinceContact > 14) {
              healthScore = "red";
            } else if (daysSinceContact > 7) {
              healthScore = "yellow";
            }
          } else {
            healthScore = "red"; // No contact date = red
          }

          return {
            id: contact.id,
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email,
            company: contact.company,
            phone: contact.phone,
            subscription_plan: contact.subscription_plan,
            last_contact_date: contact.last_contact_date,
            consultant_assigned_at: contact.created_at,
            seller_name: contact.assigned_to_profile?.full_name || null,
            seller_avatar: contact.assigned_to_profile?.avatar_url || null,
            total_steps: totalSteps,
            completed_steps: completedSteps,
            critical_pending: criticalPending,
            onboarding_progress: onboardingProgress,
            is_new_client: isNewClient,
            health_score: healthScore,
            status: contact.status,
          };
        })
      );

      return portfolioClients;
    },
    enabled: !!user?.id,
  });
}
