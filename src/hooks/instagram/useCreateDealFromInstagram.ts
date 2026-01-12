import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateDealFromInstagramParams {
  sourceType: "comment" | "message";
  sourceId: string; // comment_id or conversation_id
  contact: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    instagramUsername?: string;
  };
  deal: {
    title: string;
    pipelineId: string;
    stageId?: string;
    value?: number;
    notes?: string;
  };
}

export const useCreateDealFromInstagram = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateDealFromInstagramParams) => {
      const { sourceType, sourceId, contact, deal } = params;

      // 1. Create or find contact
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("first_name", contact.firstName)
        .eq("last_name", contact.lastName)
        .maybeSingle();

      let contactId = existingContact?.id;

      if (!contactId) {
        const { data: newContact, error: contactError } = await supabase
          .from("contacts")
          .insert({
            first_name: contact.firstName,
            last_name: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            source: contact.instagramUsername ? `instagram:@${contact.instagramUsername}` : "instagram",
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
          pipeline_id: deal.pipelineId,
          stage_id: deal.stageId,
          value: deal.value,
          contact_id: contactId,
          lead_source: "instagram",
        })
        .select()
        .single();

      if (dealError) throw dealError;

      // 3. Link source (comment or message) to contact and deal
      if (sourceType === "comment") {
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
