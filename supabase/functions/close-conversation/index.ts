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

// 🧠 Gera e persiste resumo de IA no contato após encerramento da conversa
async function generateAndSaveContactSummary(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  contactId: string
): Promise<void> {
  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.warn("[close-conversation] OPENAI_API_KEY não configurada — ai_summary não gerado");
      return;
    }

    // Buscar últimas 20 mensagens da conversa
    const { data: messages } = await supabase
      .from("messages")
      .select("content, sender_type, created_at")
      .eq("conversation_id", conversationId)
      .neq("sender_type", "system")
      .order("created_at", { ascending: true })
      .limit(20);

    if (!messages?.length) return;

    // Buscar resumo anterior do contato
    const { data: contactData } = await supabase
      .from("contacts")
      .select("ai_summary, first_name, last_name")
      .eq("id", contactId)
      .single() as { data: { ai_summary: string | null; first_name: string; last_name: string } | null };

    const previousSummary = contactData?.ai_summary || "";
    const contactName = `${contactData?.first_name || ""} ${contactData?.last_name || ""}`.trim();

    const conversationText = (messages as { sender_type: string; content: string }[])
      .map(m => `${m.sender_type === "contact" ? "Cliente" : "Atendente/IA"}: ${m.content}`)
      .join("\n");

    const prompt = previousSummary
      ? `Você é um assistente de CRM. Atualize o resumo do cliente "${contactName}" combinando o resumo anterior com a nova conversa. Máximo 3 frases cobrindo: produto/segmento do cliente, últimas solicitações e status, padrão de comportamento.\n\nResumo anterior:\n${previousSummary}\n\nNova conversa:\n${conversationText}\n\nResumo atualizado:`
      : `Você é um assistente de CRM. Crie um resumo do cliente "${contactName}" com base nesta conversa. Máximo 3 frases cobrindo: produto/segmento do cliente, solicitações feitas e status, padrão de comportamento.\n\nConversa:\n${conversationText}\n\nResumo:`;

    const llmResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!llmResponse.ok) {
      console.error("[close-conversation] LLM error ao gerar ai_summary:", await llmResponse.text());
      return;
    }

    const llmData = await llmResponse.json();
    const summary = llmData.choices?.[0]?.message?.content?.trim();
    if (!summary) return;

    await (supabase as any)
      .from("contacts")
      .update({ ai_summary: summary, ai_summary_updated_at: new Date().toISOString() })
      .eq("id", contactId);

    console.log(`[close-conversation] 🧠 ai_summary atualizado para contato ${contactId}`);
  } catch (err) {
    console.error("[close-conversation] Erro ao gerar ai_summary:", err);
  }
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

    // Fetch conversation with contact data - include Meta instance ID
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select(`
        id,
        channel,
        contact_id,
        whatsapp_instance_id,
        whatsapp_meta_instance_id,
        created_at,
        assigned_to,
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

    // Buscar instância Meta se whatsapp_meta_instance_id existir
    let metaInstance: { id: string; phone_number_id: string; status: string } | null = null;
    if (conversation.whatsapp_meta_instance_id) {
      const { data: meta } = await supabase
        .from("whatsapp_meta_instances")
        .select("id, phone_number_id, status")
        .eq("id", conversation.whatsapp_meta_instance_id)
        .single();
      
      if (meta && meta.status === 'active') {
        metaInstance = meta;
        console.log(`[close-conversation] Meta instance found: ${meta.id}`);
      }
    }

    console.log(`[close-conversation] Found conversation, channel: ${conversation.channel}`);

    // FASE 4: Buscar tags da conversa ANTES de fechar (com categoria)
    const { data: conversationTags } = await supabase
      .from("conversation_tags")
      .select(`
        tag_id,
        tags (
          id,
          name,
          color,
          category
        )
      `)
      .eq("conversation_id", conversationId);

    const tagNames = conversationTags?.map((ct: any) => ct.tags?.name).filter(Boolean) || [];
    console.log(`[close-conversation] Conversation tags: ${tagNames.join(", ") || "none"}`);

    // === VALIDAÇÃO SERVER-SIDE: Tags de conversa obrigatórias ===
    const { data: tagsRequiredConfig } = await supabase
      .from("system_configurations")
      .select("value")
      .eq("key", "conversation_tags_required")
      .maybeSingle();

    const tagsRequired = tagsRequiredConfig?.value === "true";

    if (tagsRequired) {
      const hasAnyTag = (conversationTags?.length || 0) > 0;

      if (!hasAnyTag) {
        console.warn(`[close-conversation] BLOCKED: No tag for ${conversationId}`);
        return new Response(
          JSON.stringify({
            error: "Conversa não pode ser encerrada sem uma tag vinculada.",
            code: "MISSING_CONVERSATION_TAG",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Contagem de mensagens por tipo
    const { count: messageCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId);

    const { count: agentMessageCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("sender_type", "agent");

    const { count: customerMessageCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("sender_type", "customer");

    // Calcular duração da conversa
    const startTime = new Date(conversation.created_at);
    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

    // 🆕 UPGRADE 3: Determinar resolved_by (ai, human, mixed)
    let resolvedBy: string | null = null;
    try {
      const { data: lastMessages } = await supabase
        .from("messages")
        .select("sender_type, is_ai_generated")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (lastMessages && lastMessages.length > 0) {
        const hasHumanAgent = lastMessages.some((m: any) => m.sender_type === 'agent' && !m.is_ai_generated);
        const hasAI = lastMessages.some((m: any) => m.is_ai_generated === true || m.sender_type === 'bot');
        
        if (hasAI && !hasHumanAgent) resolvedBy = 'ai';
        else if (hasHumanAgent && !hasAI) resolvedBy = 'human';
        else if (hasAI && hasHumanAgent) resolvedBy = 'mixed';
      }
      console.log(`[close-conversation] resolved_by: ${resolvedBy}`);
    } catch (resolveErr) {
      console.error(`[close-conversation] Failed to determine resolved_by:`, resolveErr);
    }

    // Update conversation status to closed
    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        status: "closed",
        closed_by: userId,
        closed_at: endTime.toISOString(),
        resolved_by: resolvedBy,
      })
      .eq("id", conversationId);

    if (updateError) {
      console.error(`[close-conversation] Failed to update conversation: ${updateError.message}`);
      throw updateError;
    }

    console.log(`[close-conversation] Conversation marked as closed`);

    // FASE 4B: Registrar métricas de qualidade para o agente
    if (userId && conversation.assigned_to) {
      try {
        // Buscar sugestões usadas nesta conversa
        const { data: suggestions } = await supabase
          .from('ai_suggestions')
          .select('id, used')
          .eq('conversation_id', conversationId);

        const suggestionsUsed = suggestions?.filter(s => s.used).length || 0;
        const suggestionsAvailable = suggestions?.length || 0;

        // Buscar classificação se existir
        const { data: classification } = await supabase
          .from('ai_suggestions')
          .select('classification_label')
          .eq('conversation_id', conversationId)
          .eq('suggestion_type', 'classification')
          .maybeSingle();

        // Buscar se foi criado KB Gap
        const { data: kbGaps } = await supabase
          .from('ai_suggestions')
          .select('id')
          .eq('conversation_id', conversationId)
          .eq('suggestion_type', 'kb_gap')
          .limit(1);

        const createdKbGap = (kbGaps?.length || 0) > 0;

        // Upsert métricas de qualidade
        await supabase
          .from('agent_quality_metrics')
          .upsert({
            agent_id: conversation.assigned_to,
            conversation_id: conversationId,
            suggestions_used: suggestionsUsed,
            suggestions_available: suggestionsAvailable,
            resolution_time_seconds: durationMinutes * 60,
            created_kb_gap: createdKbGap,
            copilot_active: suggestionsAvailable > 0,
            classification_label: classification?.classification_label,
          }, {
            onConflict: 'agent_id,conversation_id',
            ignoreDuplicates: false,
          });

        console.log(`[close-conversation] Quality metrics recorded for agent ${conversation.assigned_to}`);
      } catch (metricsError) {
        // Non-blocking - just log the error
        console.error(`[close-conversation] Failed to record quality metrics:`, metricsError);
      }
    }

    // FASE 4: Registrar tags na timeline do contato
    if (conversation.contact_id) {
      const contact = conversation.contacts as unknown as { id: string; first_name: string; last_name: string } | null;
      
      // Criar conteúdo do registro na timeline
      let timelineContent = `Conversa encerrada`;
      if (tagNames.length > 0) {
        timelineContent += `\nTags: ${tagNames.join(", ")}`;
      }
      timelineContent += `\nDuração: ${durationMinutes} minutos`;

      // Verificar se teve assistência de IA (copilot/suggestions)
      const { count: aiSuggestionsCount } = await supabase
        .from("ai_suggestions")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId);

      const hadAiAssistance = (aiSuggestionsCount || 0) > 0;

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
            message_count: messageCount || 0,
            agent_messages: agentMessageCount || 0,
            customer_messages: customerMessageCount || 0,
            channel: conversation.channel,
            had_ai_assistance: hadAiAssistance,
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
    // 🆕 Agora suporta Meta Cloud API (prioridade) e Evolution API (fallback)
    if (sendCsat && conversation.channel === "whatsapp") {
      const contact = conversation.contacts as unknown as { 
        id: string; 
        first_name: string; 
        last_name: string; 
        phone: string | null; 
        whatsapp_id: string | null 
      } | null;
      
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

        console.log(`[close-conversation] Sending CSAT for contact ${contact.id}`);

        // Helper: Extrair número limpo do whatsapp_id (prioridade) ou phone
        function extractWhatsAppNumber(whatsappId: string | null): string | null {
          if (!whatsappId) return null;
          if (whatsappId.includes('@lid')) return null; // LID não é número válido
          
          const cleaned = whatsappId
            .replace('@s.whatsapp.net', '')
            .replace('@c.us', '')
            .replace(/\D/g, '');
          
          return cleaned.length >= 10 ? cleaned : null;
        }

        const targetNumber = extractWhatsAppNumber(contact.whatsapp_id) || contact.phone?.replace(/\D/g, '');
        
        console.log(`[close-conversation] Target number: ...${targetNumber?.slice(-4)}, source: ${extractWhatsAppNumber(contact.whatsapp_id) ? 'whatsapp_id' : 'phone'}`);

        try {
          let whatsappError: { message: string } | null = null;

          // 🆕 PRIORIDADE 1: Meta Cloud API
          if (metaInstance) {
            console.log(`[close-conversation] 📤 Sending CSAT via Meta WhatsApp API to ...${targetNumber?.slice(-4)}`);
            
            const { error: metaError } = await supabase.functions.invoke("send-meta-whatsapp", {
              body: {
                instance_id: metaInstance.id,
                phone_number: targetNumber,
                message: csatMessage,
                conversation_id: conversationId,
                skip_db_save: true, // Mensagem de sistema será inserida depois
              },
            });

            whatsappError = metaError;
          }
          // FALLBACK: Evolution API
          else if (conversation.whatsapp_instance_id) {
            console.log(`[close-conversation] 📤 Sending CSAT via Evolution API to ...${targetNumber?.slice(-4)}`);
            
            const { error: evoError } = await supabase.functions.invoke("send-whatsapp-message", {
              body: {
                instance_id: conversation.whatsapp_instance_id,
                phone_number: contact.phone,
                whatsapp_id: contact.whatsapp_id,
                message: csatMessage,
              },
            });

            whatsappError = evoError;
          }
          // Nenhuma instância encontrada
          else {
            console.log(`[close-conversation] ⚠️ No WhatsApp instance found for conversation`);
            whatsappError = { message: 'No WhatsApp instance configured' };
          }

          if (whatsappError) {
            console.error(`[close-conversation] Failed to send WhatsApp CSAT: ${whatsappError.message}`);
          } else {
            console.log(`[close-conversation] ✅ CSAT sent via WhatsApp successfully`);

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

    // 🧠 Gerar resumo de IA e persistir no contato (assíncrono, não bloqueia resposta)
    if (conversation.contact_id) {
      EdgeRuntime.waitUntil(
        generateAndSaveContactSummary(supabase, conversationId, conversation.contact_id)
      );
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
