import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CloseConversationRequest {
  conversationId: string;
  userId: string;
  sendCsat: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { conversationId, userId, sendCsat }: CloseConversationRequest = await req.json();

    console.log(`[close-conversation] Starting for conversation ${conversationId}, sendCsat: ${sendCsat}`);

    if (!conversationId || !userId) {
      return new Response(
        JSON.stringify({ error: "conversationId and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch conversation with contact data
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select(`
        id,
        channel,
        contact_id,
        whatsapp_instance_id,
        created_at,
        contacts (
          id,
          first_name,
          last_name,
          phone,
          whatsapp_id
        )
      `)
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      console.error(`[close-conversation] Conversation not found: ${convError?.message}`);
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[close-conversation] Found conversation, channel: ${conversation.channel}`);

    // FASE 4: Buscar tags da conversa ANTES de fechar
    const { data: conversationTags } = await supabase
      .from("conversation_tags")
      .select(`
        tag_id,
        tags (
          id,
          name,
          color
        )
      `)
      .eq("conversation_id", conversationId);

    const tagNames = conversationTags?.map((ct: any) => ct.tags?.name).filter(Boolean) || [];
    console.log(`[close-conversation] Conversation tags: ${tagNames.join(", ") || "none"}`);

    // Calcular duração da conversa
    const startTime = new Date(conversation.created_at);
    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

    // Update conversation status to closed
    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        status: "closed",
        closed_by: userId,
        closed_at: endTime.toISOString(),
      })
      .eq("id", conversationId);

    if (updateError) {
      console.error(`[close-conversation] Failed to update conversation: ${updateError.message}`);
      throw updateError;
    }

    console.log(`[close-conversation] Conversation marked as closed`);

    // FASE 4: Registrar tags na timeline do contato
    if (conversation.contact_id) {
      const contact = conversation.contacts as unknown as { id: string; first_name: string; last_name: string } | null;
      
      // Criar conteúdo do registro na timeline
      let timelineContent = `Conversa encerrada`;
      if (tagNames.length > 0) {
        timelineContent += `\nTags: ${tagNames.join(", ")}`;
      }
      timelineContent += `\nDuração: ${durationMinutes} minutos`;

      const { error: interactionError } = await supabase
        .from("interactions")
        .insert({
          customer_id: conversation.contact_id,
          type: "note",
          channel: conversation.channel === "whatsapp" ? "whatsapp" : 
                   conversation.channel === "email" ? "email" : "phone",
          content: timelineContent,
          metadata: {
            conversation_id: conversationId,
            closed_by: userId,
            duration_minutes: durationMinutes,
            tags: tagNames,
            auto_generated: true,
          },
        });

      if (interactionError) {
        console.error(`[close-conversation] Failed to create timeline entry: ${interactionError.message}`);
      } else {
        console.log(`[close-conversation] Timeline entry created with tags: ${tagNames.join(", ")}`);
      }
    }

    // Send CSAT via WhatsApp if requested and applicable
    if (sendCsat && conversation.channel === "whatsapp" && conversation.whatsapp_instance_id) {
      const contact = conversation.contacts as unknown as { id: string; first_name: string; last_name: string; phone: string | null; whatsapp_id: string | null } | null;
      
      if (contact && (contact.phone || contact.whatsapp_id)) {
        const csatMessage = `📊 *Pesquisa de Satisfação*

Seu atendimento foi encerrado.

Por favor, avalie de 1 a 5:

1️⃣ Péssimo
2️⃣ Ruim
3️⃣ Regular
4️⃣ Bom
5️⃣ Excelente

_Responda apenas com o número._`;

        console.log(`[close-conversation] Sending CSAT to WhatsApp for contact ${contact.id}`);

        try {
          const { error: whatsappError } = await supabase.functions.invoke("send-whatsapp-message", {
            body: {
              instance_id: conversation.whatsapp_instance_id,
              phone_number: contact.phone,
              whatsapp_id: contact.whatsapp_id,
              message: csatMessage,
            },
          });

          if (whatsappError) {
            console.error(`[close-conversation] Failed to send WhatsApp CSAT: ${whatsappError.message}`);
          } else {
            console.log(`[close-conversation] CSAT sent via WhatsApp successfully`);

            // Mark conversation as awaiting rating
            await supabase
              .from("conversations")
              .update({
                awaiting_rating: true,
                rating_sent_at: new Date().toISOString(),
              })
              .eq("id", conversationId);

            console.log(`[close-conversation] Conversation marked as awaiting_rating`);
          }
        } catch (whatsappErr) {
          console.error(`[close-conversation] WhatsApp send error:`, whatsappErr);
        }
      } else {
        console.log(`[close-conversation] No phone/whatsapp_id for contact, skipping WhatsApp CSAT`);
      }
    }

    // Insert system message for history (regardless of channel)
    const { error: messageError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        content: "Seu atendimento foi encerrado. Por favor, avalie nosso atendimento de 1 a 5 estrelas! ⭐",
        sender_type: "system",
      });

    if (messageError) {
      console.error(`[close-conversation] Failed to insert system message: ${messageError.message}`);
    }

    console.log(`[close-conversation] Completed successfully`);

    return new Response(
      JSON.stringify({ success: true, conversationId, tags_recorded: tagNames }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[close-conversation] Error:`, error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
