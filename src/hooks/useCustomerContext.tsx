import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCustomerContext(contactId: string | null) {
  return useQuery({
    queryKey: ["customer-context", contactId],
    queryFn: async () => {
      if (!contactId) return null;

      // Fetch contact with seller and consultant profiles
      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .select(`
          *,
          seller:profiles!contacts_assigned_to_fkey(id, full_name, avatar_url),
          consultant:profiles!contacts_consultant_id_fkey(id, full_name, avatar_url)
        `)
        .eq("id", contactId)
        .single();

      if (contactError) throw contactError;

    // Fetch won deal with product and handoff fields
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select(`
        id,
        title,
        value,
        currency,
        closed_at,
        probability,
        expected_revenue,
        success_criteria,
        pain_points,
        churn_risk,
        product:product_id(id, name)
      `)
        .eq("contact_id", contactId)
        .eq("status", "won")
        .order("closed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dealError) throw dealError;

      // Fetch journey steps
      const { data: journeySteps, error: stepsError } = await supabase
        .from("customer_journey_steps")
        .select(`
          *,
          completed_by_profile:completed_by(id, full_name, avatar_url)
        `)
        .eq("contact_id", contactId)
        .order("position", { ascending: true });

      if (stepsError) throw stepsError;

      return {
        contact,
        deal,
        journeySteps: journeySteps || [],
        seller: contact?.seller || null,
        consultant: contact?.consultant || null,
      };
    },
    enabled: !!contactId,
  });
}
