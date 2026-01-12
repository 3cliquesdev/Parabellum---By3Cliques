import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateDealFromInstagramParams {
  type: "comment" | "message";
  sourceId: string; // comment_id or conversation_id
  contact: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
  };
  deal: {
    title: string;
    pipeline_id: string;
    stage_id?: string;
    value?: number;
    notes?: string;
  };
}

export const useCreateDealFromInstagram = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateDealFromInstagramParams) => {
      const { type, sourceId, contact, deal } = params;

      // 1. Create or find contact
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("first_name", contact.first_name)
        .eq("last_name", contact.last_name)
        .maybeSingle();

      let contactId = existingContact?.id;

      if (!contactId) {
        const { data: newContact, error: contactError } = await supabase
          .from("contacts")
          .insert({
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email,
            phone: contact.phone,
            source: "instagram",
          })
          .select()
          .single();

        if (contactError) throw contactError;
        contactId = newContact.id;
      }

      // 2. Create deal
      const { data: newDeal, error: dealError } = await supabase
        .from("deals")
        .insert({
          title: deal.title,
          pipeline_id: deal.pipeline_id,
          stage_id: deal.stage_id,
          value: deal.value,
          contact_id: contactId,
          lead_source: "instagram",
        })
        .select()
        .single();

      if (dealError) throw dealError;

      // 3. Link source (comment or message) to contact and deal
      if (type === "comment") {
        await supabase
          .from("instagram_comments")
          .update({
            contact_id: contactId,
            deal_id: newDeal.id,
            status: "converted",
            notes: deal.notes,
          })
          .eq("id", sourceId);
      } else {
        await supabase
          .from("instagram_messages")
          .update({
            contact_id: contactId,
            deal_id: newDeal.id,
            status: "converted",
          })
          .eq("conversation_id", sourceId);
      }

      return { contact: { id: contactId }, deal: newDeal };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-comments"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-messages"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-stats"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Deal criado com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating deal from Instagram:", error);
      toast.error("Erro ao criar deal");
    },
  });
};
