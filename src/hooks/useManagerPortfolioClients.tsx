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

  const isGeneralManager = role === "general_manager";

  return useQuery({
    queryKey: ["manager-portfolio-clients", user?.id, role],
    queryFn: async () => {
      if (!user?.id) return [];

      console.log("📊 Fetching manager portfolio clients...");

      let contacts: any[] = [];
      let consultantsMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();

      if (isAdmin || isGeneralManager) {
        // Admin: fetch ALL customers with a consultant
        const { data, error } = await supabase
          .from("contacts")
          .select("*")
          .eq("status", "customer")
          .not("consultant_id", "is", null)
          .order("created_at", { ascending: false });

        if (error) { console.error("❌ Error fetching contacts:", error); throw error; }
        contacts = data || [];

        // Fetch consultant profiles for name/avatar mapping
        const uniqueConsultantIds = [...new Set(contacts.map(c => c.consultant_id).filter(Boolean))];
        if (uniqueConsultantIds.length > 0) {
          const { data: consultants } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", uniqueConsultantIds);

          consultants?.forEach(c => consultantsMap.set(c.id, { full_name: c.full_name, avatar_url: c.avatar_url }));
        }
      } else {
        // Manager/cs_manager: filter by department
        const { data: profile } = await supabase
          .from("profiles")
          .select("department")
          .eq("id", user.id)
          .single();

        const dept = profile?.department;
        if (!dept) { console.log("⚠️ No department found"); return []; }

        const { data: consultants, error: cErr } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("department", dept);

        if (cErr) { console.error("❌ Error fetching consultants:", cErr); throw cErr; }

        const consultantIds = consultants?.map(c => c.id) || [];
        if (consultantIds.length === 0) return [];

        consultants?.forEach(c => consultantsMap.set(c.id, { full_name: c.full_name, avatar_url: c.avatar_url }));

        const { data, error } = await supabase
          .from("contacts")
          .select("*")
          .eq("status", "customer")
          .in("consultant_id", consultantIds)
          .order("created_at", { ascending: false });

        if (error) { console.error("❌ Error fetching contacts:", error); throw error; }
        contacts = data || [];
      }

      if (contacts.length === 0) return [];

      console.log(`✅ Found ${contacts.length} customers`);

      // Batch fetch all journey steps for all contacts
      const contactIds = contacts.map(c => c.id);
      const { data: allSteps } = await supabase
        .from("customer_journey_steps")
        .select("contact_id, completed, is_critical")
        .in("contact_id", contactIds);

      const stepsMap = new Map<string, any[]>();
      allSteps?.forEach(s => {
        if (!stepsMap.has(s.contact_id)) stepsMap.set(s.contact_id, []);
        stepsMap.get(s.contact_id)!.push(s);
      });

      // Batch fetch seller profiles
      const sellerIds = [...new Set(contacts.map(c => c.assigned_to).filter(Boolean))];
      const sellersMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", sellerIds);

        sellers?.forEach(s => sellersMap.set(s.id, { full_name: s.full_name, avatar_url: s.avatar_url }));
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const clientsWithDetails: ManagerPortfolioClient[] = contacts.map((contact) => {
        const steps = stepsMap.get(contact.id) || [];
        const total_steps = steps.length;
        const completed_steps = steps.filter(s => s.completed).length;
        const critical_pending = steps.filter(s => s.is_critical && !s.completed).length;
        const onboarding_progress = total_steps > 0 ? (completed_steps / total_steps) * 100 : 0;

        const is_new_client = new Date(contact.created_at) >= sevenDaysAgo;

        let health_score: "green" | "yellow" | "red" = "green";
        if (contact.last_contact_date) {
          const daysSince = Math.floor((Date.now() - new Date(contact.last_contact_date).getTime()) / (1000 * 60 * 60 * 24));
          if (daysSince > 30) health_score = "red";
          else if (daysSince > 15) health_score = "yellow";
        }

        const consultant = consultantsMap.get(contact.consultant_id);
        const seller = contact.assigned_to ? sellersMap.get(contact.assigned_to) : null;

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
          seller_name: seller?.full_name || null,
          seller_avatar: seller?.avatar_url || null,
          total_steps,
          completed_steps,
          critical_pending,
          onboarding_progress,
          is_new_client,
          health_score,
        };
      });

      return clientsWithDetails;
    },
    enabled: !!user?.id && (isAdmin || isGeneralManager || isManager || isCSManager),
    staleTime: 1000 * 60 * 2,
  });
}
