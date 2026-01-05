import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  console.log("[inbound-email] ========= NOVA REQUISIÇÃO =========");
  console.log("[inbound-email] Method:", req.method);
  console.log("[inbound-email] URL:", req.url);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Verificar secret configurado - usa RESEND_WEBHOOK_SECRET_INBOUND ou fallback
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET_INBOUND') || Deno.env.get('RESEND_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('[inbound-email] RESEND_WEBHOOK_SECRET_INBOUND not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extrair headers Svix
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error('[inbound-email] Missing Svix headers');
      return new Response(
        JSON.stringify({ error: 'Missing webhook signature headers' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ler body como texto para validação
    const body = await req.text();
    const signedContent = `${svixId}.${svixTimestamp}.${body}`;

    // Calcular assinatura esperada
    const encoder = new TextEncoder();
    const keyData = encoder.encode(webhookSecret);
    const key = await crypto.subtle.importKey(
      'raw', keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    );

    const signatureData = await crypto.subtle.sign('HMAC', key, encoder.encode(signedContent));
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureData)));

    // Verificar assinatura
    const signatures = svixSignature.split(' ');
    const versionedSignatures = signatures.filter(sig => sig.startsWith('v1,'));

    if (versionedSignatures.length === 0) {
      console.error('[inbound-email] No v1 signature found');
      return new Response(
        JSON.stringify({ error: 'Invalid signature version' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const providedSignature = versionedSignatures[0].replace('v1,', '');

    if (providedSignature !== expectedSignature) {
      console.error('[inbound-email] Signature verification failed');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('[inbound-email] ✅ Signature verified successfully');

    // Agora parsear o JSON
    const payload = JSON.parse(body);
    console.log("[inbound-email] Payload received:", JSON.stringify(payload, null, 2));

    // Resend webhook payload structure
    const { from, to, subject, text, html, headers } = payload;
    const emailContent = text || html || "Email sem conteúdo";

    // Extrair headers de threading para detectar respostas
    const inReplyTo = headers?.["In-Reply-To"] || headers?.["in-reply-to"];
    const references = headers?.["References"] || headers?.["references"];
    const messageId = headers?.["Message-ID"] || headers?.["message-id"];

    console.log("[inbound-email] Threading headers:", { inReplyTo, references, messageId });

    // ========== VERIFICAR SE É RESPOSTA A UM TICKET EXISTENTE ==========
    if (inReplyTo || references) {
      // Extrair message-id da referência (pode vir como lista separada por espaço)
      const referencedMessageIds: string[] = [];
      if (inReplyTo) referencedMessageIds.push(inReplyTo.trim().replace(/^<|>$/g, ''));
      if (references) {
        references.split(/\s+/).forEach((ref: string) => {
          const cleaned = ref.trim().replace(/^<|>$/g, '');
          if (cleaned && !referencedMessageIds.includes(cleaned)) {
            referencedMessageIds.push(cleaned);
          }
        });
      }

      console.log("[inbound-email] Buscando ticket por message_ids:", referencedMessageIds);

      // Buscar ticket que tenha qualquer um dos message_ids referenciados
      for (const refMessageId of referencedMessageIds) {
        const { data: existingTicket, error: ticketError } = await supabase
          .from("tickets")
          .select("id, subject, channel, customer_id, assigned_to, status")
          .eq("last_email_message_id", refMessageId)
          .single();

        if (existingTicket && !ticketError) {
          console.log("[inbound-email] ✅ Encontrado ticket existente:", existingTicket.id);

          // Adicionar como comentário no ticket
          const { error: commentError } = await supabase.from("ticket_comments").insert({
            ticket_id: existingTicket.id,
            content: emailContent,
            user_id: null, // Comentário do cliente (não de agente)
            is_internal: false,
          });

          if (commentError) {
            console.error("[inbound-email] Erro ao inserir comentário:", commentError);
          } else {
            console.log("[inbound-email] ✅ Comentário adicionado ao ticket");
          }

          // Atualizar ticket: status, message_id e updated_at
          const updateData: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          
          // Atualizar last_email_message_id se tiver novo
          if (messageId) {
            updateData.last_email_message_id = messageId.replace(/^<|>$/g, '');
          }

          // Reabrir ticket se estava aguardando cliente
          if (existingTicket.status === 'pending' || existingTicket.status === 'awaiting_customer') {
            updateData.status = 'open';
            console.log("[inbound-email] Reabrindo ticket que estava aguardando");
          }

          await supabase
            .from("tickets")
            .update(updateData)
            .eq("id", existingTicket.id);

          // Notificar agente atribuído (se houver)
          if (existingTicket.assigned_to) {
            await supabase.from("notifications").insert({
              user_id: existingTicket.assigned_to,
              title: "Nova resposta do cliente",
              message: `Cliente respondeu ao ticket #${existingTicket.id.slice(0, 8)}`,
              type: "ticket_reply",
              read: false,
            });
            console.log("[inbound-email] ✅ Notificação enviada ao agente");
          }

          return new Response(
            JSON.stringify({
              success: true,
              action: "ticket_comment_added",
              ticket_id: existingTicket.id,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      console.log("[inbound-email] Nenhum ticket encontrado por message_id, tentando por subject...");
      
      // Fallback: buscar por ticket ID no subject (ex: "Re: ... #abc12345")
      if (subject) {
        const ticketIdMatch = subject.match(/#([a-f0-9]{8})/i);
        if (ticketIdMatch) {
          const partialId = ticketIdMatch[1];
          console.log("[inbound-email] Buscando ticket por ID parcial no subject:", partialId);
          
          const { data: ticketBySubject } = await supabase
            .from("tickets")
            .select("id, subject, channel, customer_id, assigned_to, status")
            .ilike("id", `${partialId}%`)
            .single();
          
          if (ticketBySubject) {
            console.log("[inbound-email] ✅ Ticket encontrado por subject:", ticketBySubject.id);
            
            // Adicionar como comentário no ticket
            const { error: commentError } = await supabase.from("ticket_comments").insert({
              ticket_id: ticketBySubject.id,
              content: emailContent,
              user_id: null,
              is_internal: false,
            });

            if (commentError) {
              console.error("[inbound-email] Erro ao inserir comentário:", commentError);
            } else {
              console.log("[inbound-email] ✅ Comentário adicionado ao ticket via subject match");
            }

            // Atualizar ticket
            const updateData: Record<string, any> = {
              updated_at: new Date().toISOString(),
            };
            
            if (messageId) {
              updateData.last_email_message_id = messageId.replace(/^<|>$/g, '');
            }

            if (ticketBySubject.status === 'pending' || ticketBySubject.status === 'awaiting_customer') {
              updateData.status = 'open';
            }

            await supabase
              .from("tickets")
              .update(updateData)
              .eq("id", ticketBySubject.id);

            // Notificar agente
            if (ticketBySubject.assigned_to) {
              await supabase.from("notifications").insert({
                user_id: ticketBySubject.assigned_to,
                title: "Nova resposta do cliente",
                message: `Cliente respondeu ao ticket #${ticketBySubject.id.slice(0, 8)}`,
                type: "ticket_reply",
                read: false,
              });
            }

            return new Response(
              JSON.stringify({
                success: true,
                action: "ticket_comment_added_via_subject",
                ticket_id: ticketBySubject.id,
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }
      }
      
      console.log("[inbound-email] Nenhum ticket encontrado, continuando fluxo normal...");
    }

    // ========== FLUXO NORMAL: NOVO EMAIL (não é resposta a ticket) ==========

    // 1. Extract sender email and name
    const fromEmail = from.match(/<(.+)>/)?.[1] || from;
    const fromName = from.match(/^([^<]+)/)?.[1]?.trim() || fromEmail.split("@")[0];

    console.log("[inbound-email] Sender:", { fromEmail, fromName });

    // 2. Find or create contact
    let { data: contact, error: contactFetchError } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email")
      .eq("email", fromEmail)
      .single();

    if (contactFetchError && contactFetchError.code !== "PGRST116") {
      throw contactFetchError;
    }

    if (!contact) {
      console.log("[inbound-email] Creating new contact...");
      const nameParts = fromName.split(" ");
      const { data: newContact, error: createError } = await supabase
        .from("contacts")
        .insert({
          email: fromEmail,
          first_name: nameParts[0] || fromName,
          last_name: nameParts.slice(1).join(" ") || "",
          source: "email",
        })
        .select()
        .single();

      if (createError) throw createError;
      contact = newContact;
    }

    console.log("[inbound-email] Contact:", contact);

    if (!contact) {
      throw new Error("Failed to find or create contact");
    }

    // FASE 2: NOVO FLUXO - Criar Conversa + Disparar IA (não criar ticket direto)
    console.log("[inbound-email] 🔄 NOVO FLUXO: Criando conversa com canal=email...");

    // Buscar departamento Suporte
    const { data: supportDept } = await supabase
      .from("departments")
      .select("id, name")
      .eq("name", "Suporte")
      .eq("is_active", true)
      .single();

    if (!supportDept) {
      throw new Error("Departamento Suporte não encontrado");
    }

    // Usar RPC get_or_create_conversation com channel='email'
    const { data: conversationData, error: convError } = await supabase
      .rpc('get_or_create_conversation', {
        p_contact_id: contact.id,
        p_department_id: supportDept.id,
        p_channel: 'email'
      })
      .single();

    if (convError) {
      console.error('[inbound-email] Erro ao criar conversa:', convError);
      throw new Error(`Failed to create conversation: ${convError.message}`);
    }

    const conversationId = (conversationData as any).conversation_id;
    console.log(`[inbound-email] ✅ Conversa criada/recuperada: ${conversationId}`);

    // Inserir mensagem do cliente na conversa
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      content: emailContent,
      sender_type: 'contact',
      channel: 'email',
      status: 'delivered'
    });

    console.log('[inbound-email] ✅ Mensagem do cliente inserida');

    // DISPARAR IA para responder automaticamente
    console.log('[inbound-email] 🤖 Disparando IA para responder...');
    
    try {
      await supabase.functions.invoke('ai-autopilot-chat', {
        body: {
          conversationId,
          customerMessage: emailContent,
          customer_context: {
            name: `${contact.first_name} ${contact.last_name}`.trim(),
            email: contact.email,
            isVerified: true
          }
        }
      });
      
      console.log('[inbound-email] ✅ IA disparada com sucesso');
    } catch (aiError) {
      console.error('[inbound-email] ⚠️ Erro ao disparar IA:', aiError);
      // Se IA falhar, fazer fallback para criar ticket (como antes)
      console.log('[inbound-email] Fallback: criando ticket...');
      
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          customer_id: contact.id,
          subject: subject.replace(/^re:\s*/i, "").trim(),
          description: emailContent,
          channel: "email",
          status: "open",
          priority: "medium",
          department_id: supportDept.id,
          source_conversation_id: conversationId,
          last_email_message_id: headers["Message-ID"] || null,
        })
        .select()
        .single();

      if (ticketError) throw ticketError;
      
      console.log("[inbound-email] Ticket fallback criado:", ticket.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: "conversation_created_with_ai",
        conversation_id: conversationId,
        contact_id: contact.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[inbound-email] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});