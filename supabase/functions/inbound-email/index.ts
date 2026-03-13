import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Tipo para anexo salvo
interface SavedAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

// Função para processar e salvar anexos de email
async function processEmailAttachments(
  supabase: any,
  ticketId: string,
  attachments: any[] | undefined
): Promise<SavedAttachment[]> {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  console.log(`[inbound-email] 📎 Processando ${attachments.length} anexo(s)...`);
  const savedAttachments: SavedAttachment[] = [];

  for (const attachment of attachments) {
    try {
      // Resend fornece: filename, content_type, content (base64)
      const fileName = attachment.filename || attachment.name || `attachment-${Date.now()}`;
      const contentType = attachment.content_type || attachment.type || 'application/octet-stream';
      const content = attachment.content || attachment.data;

      if (!content) {
        console.warn(`[inbound-email] ⚠️ Anexo sem conteúdo: ${fileName}`);
        continue;
      }

      // Decode base64
      const binaryString = atob(content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Path único no storage
      const storagePath = `email-replies/${ticketId}/${Date.now()}-${fileName}`;

      console.log(`[inbound-email] 📤 Uploading: ${fileName} (${bytes.length} bytes)`);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ticket-attachments')
        .upload(storagePath, bytes, {
          contentType,
          upsert: false
        });

      if (uploadError) {
        console.error(`[inbound-email] ❌ Erro upload ${fileName}:`, uploadError.message);
        continue;
      }

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('ticket-attachments')
        .getPublicUrl(uploadData.path);

      savedAttachments.push({
        url: publicUrl,
        name: fileName,
        type: contentType,
        size: bytes.length
      });

      console.log(`[inbound-email] ✅ Anexo salvo: ${fileName}`);
    } catch (err: any) {
      console.error(`[inbound-email] ❌ Erro processando anexo:`, err.message);
    }
  }

  console.log(`[inbound-email] 📎 Total anexos salvos: ${savedAttachments.length}`);
  return savedAttachments;
}

// Inline HMAC verification helper (to avoid external CDN dependency)
async function verifyWebhookSignature(payload: string, secret: string, headers: Record<string, string>): Promise<boolean> {
  const timestamp = headers["webhook-timestamp"];
  const signatures = headers["webhook-signature"]?.split(" ") || [];
  
  // Remove whsec_ prefix if present
  const secretKey = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  
  // Decode base64 secret
  const keyData = Uint8Array.from(atob(secretKey), c => c.charCodeAt(0));
  
  // Create signed payload (timestamp.payload)
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(signedPayload);
  
  // Import key for HMAC
  const key = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  
  // Generate expected signature
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const expectedSig = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  // Check if any provided signature matches
  for (const sig of signatures) {
    const [version, providedSig] = sig.split(",");
    if (version === "v1" && providedSig === expectedSig) {
      return true;
    }
  }
  return false;
}

Deno.serve(async (req) => {
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

    // Logs para debug do secret
    console.log('[inbound-email] Secret debug:', {
      hasPrefix: webhookSecret.startsWith('whsec_'),
      secretLength: webhookSecret.length,
    });

    // Ler body como texto para validação
    const body = await req.text();
    
    // Extrair headers Svix e mapear para formato que a biblioteca espera
    const svixId = req.headers.get("svix-id") || "";
    const svixTimestamp = req.headers.get("svix-timestamp") || "";
    const svixSignature = req.headers.get("svix-signature") || "";

    console.log('[inbound-email] Svix headers recebidos:', {
      hasId: !!svixId,
      hasTimestamp: !!svixTimestamp,
      hasSignature: !!svixSignature,
    });

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error('[inbound-email] Missing Svix headers');
      return new Response(
        JSON.stringify({ error: 'Missing webhook signature headers' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mapear headers Svix -> Standard Webhooks format
    const webhookHeaders = {
      "webhook-id": svixId,
      "webhook-timestamp": svixTimestamp,
      "webhook-signature": svixSignature,
    };

    console.log('[inbound-email] Headers mapeados para verificação:', Object.keys(webhookHeaders));

    // Verificar assinatura usando implementação inline
    try {
      const isValid = await verifyWebhookSignature(body, webhookSecret, webhookHeaders);
      if (!isValid) {
        throw new Error("Signature mismatch");
      }
      console.log('[inbound-email] ✅ Signature verified successfully');
    } catch (verifyError: any) {
      console.error('[inbound-email] ❌ Webhook verification failed:', verifyError.message);
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature', details: verifyError.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Função para buscar conteúdo completo do email via API Resend
    async function fetchEmailContent(emailId: string): Promise<{ text?: string; html?: string }> {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        console.warn("[inbound-email] RESEND_API_KEY não configurada, não é possível buscar conteúdo");
        return {};
      }

      try {
        console.log(`[inbound-email] Buscando conteúdo do email ${emailId} via API Resend...`);
        
        const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          }
        });

        if (!response.ok) {
          console.error(`[inbound-email] Erro ao buscar email: ${response.status} ${response.statusText}`);
          return {};
        }

        const fetchedEmailData = await response.json();
        
        // 📥 LOG DETALHADO DA RESPOSTA API RESEND
        console.log("[inbound-email] 📥 Resposta API Resend - keys:", Object.keys(fetchedEmailData));
        console.log("[inbound-email] 📥 Resposta API Resend - preview:", JSON.stringify(fetchedEmailData, null, 2).slice(0, 1500));
        console.log("[inbound-email] ✅ Conteúdo do email recuperado:", {
          hasText: !!fetchedEmailData.text,
          hasHtml: !!fetchedEmailData.html,
          textLength: fetchedEmailData.text?.length || 0,
          htmlLength: fetchedEmailData.html?.length || 0
        });

        return { text: fetchedEmailData.text, html: fetchedEmailData.html };
      } catch (error) {
        console.error("[inbound-email] Erro ao buscar conteúdo do email:", error);
        return {};
      }
    }

    // Agora parsear o JSON
    const payload = JSON.parse(body);
    
    // 📦 LOG DETALHADO DO PAYLOAD
    console.log("[inbound-email] 📦 PAYLOAD COMPLETO:");
    console.log("[inbound-email] - type:", typeof payload);
    console.log("[inbound-email] - keys:", Object.keys(payload));
    console.log("[inbound-email] - payload.data keys:", payload.data ? Object.keys(payload.data) : "N/A");
    console.log("[inbound-email] - event type:", payload.type || payload.event || "N/A");
    console.log("[inbound-email] - raw payload:", JSON.stringify(payload, null, 2));

    // Resend webhook: dados do email vêm dentro de payload.data
    const emailData = payload.data || payload;
    const { from, to, subject, text, html, attachments, email_id } = emailData;
    
    // 📧 LOG DETALHADO DOS DADOS DO EMAIL
    console.log("[inbound-email] 📧 DADOS DO EMAIL:");
    console.log("[inbound-email] - from:", from);
    console.log("[inbound-email] - to:", to);
    console.log("[inbound-email] - subject:", subject);
    console.log("[inbound-email] - email_id:", email_id);
    console.log("[inbound-email] - text presente:", !!text, "| length:", text?.length || 0);
    console.log("[inbound-email] - html presente:", !!html, "| length:", html?.length || 0);
    console.log("[inbound-email] - attachments:", attachments?.length || 0);
    
    // Se não veio conteúdo no webhook, buscar via API Resend
    let emailContent = text || html;
    if (!emailContent && email_id) {
      console.log("[inbound-email] Conteúdo vazio no webhook, buscando via API...");
      const fetchedContent = await fetchEmailContent(email_id);
      if (fetchedContent.text || fetchedContent.html) {
        emailContent = fetchedContent.text || fetchedContent.html!;
      } else {
        // Fallback informativo se API falhar (401/erro)
        const senderInfo = from || "remetente desconhecido";
        emailContent = `📧 Resposta recebida de ${senderInfo}\n\nAssunto: ${subject || "(sem assunto)"}\n\n[Conteúdo não disponível - verifique RESEND_API_KEY tem permissão Full Access]`;
        console.warn("[inbound-email] ⚠️ Usando fallback de conteúdo - API não retornou dados");
      }
    } else if (!emailContent) {
      const senderInfo = from || "remetente desconhecido";
      emailContent = `📧 Email recebido de ${senderInfo}\n\nAssunto: ${subject || "(sem assunto)"}\n\n[Conteúdo não disponível no webhook]`;
    }

    console.log("[inbound-email] Email data:", { from, subject, hasText: !!text, hasHtml: !!html, hasEmailId: !!email_id, contentLength: emailContent?.length });

    // Extrair headers de threading - Resend pode fornecer de formas diferentes
    const headers = emailData.headers || {};
    const inReplyTo = headers["In-Reply-To"] || headers["in-reply-to"] || emailData.in_reply_to;
    const references = headers["References"] || headers["references"] || emailData.references;
    const messageId = headers["Message-ID"] || headers["message-id"] || emailData.message_id;

    // 🔗 LOG DETALHADO DOS HEADERS DE THREADING
    console.log("[inbound-email] 🔗 THREADING HEADERS DETALHADOS:");
    console.log("[inbound-email] - emailData.headers:", JSON.stringify(headers, null, 2));
    console.log("[inbound-email] - emailData.in_reply_to:", emailData.in_reply_to);
    console.log("[inbound-email] - emailData.references:", emailData.references);
    console.log("[inbound-email] - emailData.message_id:", emailData.message_id);
    console.log("[inbound-email] - Valores extraídos: inReplyTo=", inReplyTo, "| references=", references, "| messageId=", messageId);

    // ========== VERIFICAR SE É RESPOSTA A UM TICKET EXISTENTE ==========
    
    // PASSO 1: Tentar por headers In-Reply-To/References
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
        console.log("[inbound-email] 🔍 Buscando ticket com last_email_message_id =", refMessageId);
        
        const { data: existingTicket, error: ticketError } = await supabase
          .from("tickets")
         .select("id, subject, channel, customer_id, assigned_to, status, last_email_message_id, ticket_number")
          .eq("last_email_message_id", refMessageId)
          .single();

        // 🔍 LOG DO RESULTADO DA BUSCA POR MESSAGE_ID
        console.log("[inbound-email] 🔍 Resultado busca por message_id:", {
          buscado: refMessageId,
          encontrado: !!existingTicket,
          ticketId: existingTicket?.id || null,
          ticketMessageId: existingTicket?.last_email_message_id || null,
          erro: ticketError?.message || null,
          erroCode: ticketError?.code || null
        });

        if (existingTicket && !ticketError) {
          console.log("[inbound-email] ✅ Encontrado ticket existente:", existingTicket.id);

          // Processar anexos do email
          const savedAttachments = await processEmailAttachments(supabase, existingTicket.id, attachments);

          // Adicionar como comentário no ticket (com anexos)
          const { error: commentError } = await supabase.from("ticket_comments").insert({
            ticket_id: existingTicket.id,
            content: emailContent,
            created_by: null, // Comentário do cliente (não de agente)
            is_internal: false,
            source: "email_reply",
            attachments: savedAttachments.length > 0 ? savedAttachments : null,
          });

          if (commentError) {
            console.error("[inbound-email] Erro ao inserir comentário:", commentError);
          } else {
            console.log("[inbound-email] ✅ Comentário adicionado ao ticket", savedAttachments.length > 0 ? `com ${savedAttachments.length} anexo(s)` : "");
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
              metadata: {
                ticket_id: existingTicket.id,
                ticket_number: existingTicket.ticket_number || null,
                action_url: `/support?ticket=${existingTicket.id}`,
              },
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

      console.log("[inbound-email] Nenhum ticket encontrado por message_id headers");
    }

    // PASSO 2: FALLBACK INDEPENDENTE - Buscar por ticket ID no subject (ex: "Re: ... #abc12345")
    // Este bloco executa SEMPRE que não retornou acima, mesmo sem headers
    console.log("[inbound-email] 🔍 Iniciando busca por subject fallback...");
    console.log("[inbound-email] 🔍 Subject para análise:", subject);
    
    if (subject && typeof subject === 'string') {
      // Tentar match com formato TK-YYYY-NNNNN (ticket_number) primeiro
      const ticketNumberMatch = subject.match(/#(TK-\d{4}-\d{5})/i);
      // Fallback para formato UUID parcial (8 caracteres hex)
      const ticketUuidMatch = subject.match(/#([a-f0-9]{8})/i);
      const ticketIdMatch = ticketNumberMatch || ticketUuidMatch;
      
      console.log("[inbound-email] 🔍 Regex match results:", {
        ticketNumberMatch: ticketNumberMatch?.[1] || null,
        ticketUuidMatch: ticketUuidMatch?.[1] || null,
        finalMatch: ticketIdMatch?.[1] || null
      });
      
      if (ticketIdMatch) {
        const matchedId = ticketIdMatch[1];
        const isTicketNumber = matchedId.toUpperCase().startsWith('TK-');
        console.log("[inbound-email] Buscando ticket por:", { matchedId, isTicketNumber });
        
        let ticketBySubject: any = null;
        let subjectError: any = null;
        
        if (isTicketNumber) {
          // Buscar por ticket_number (formato TK-YYYY-NNNNN)
          const { data, error } = await supabase
            .from("tickets")
            .select("id, subject, channel, customer_id, assigned_to, status, last_email_message_id, ticket_number")
            .eq("ticket_number", matchedId.toUpperCase())
            .maybeSingle();
          
          ticketBySubject = data;
          subjectError = error;
        } else {
          // Buscar por UUID parcial (compatibilidade com formato antigo)
          const { data: ticketBySubjectArray, error } = await supabase
            .rpc("find_ticket_by_partial_id", { partial_id: matchedId });
          
          ticketBySubject = ticketBySubjectArray?.[0] || null;
          subjectError = error;
        }
        
        // 🔍 LOG DO RESULTADO DA BUSCA POR SUBJECT
        console.log("[inbound-email] 🔍 Resultado busca por subject:", {
          matchedId,
          isTicketNumber,
          encontrado: !!ticketBySubject,
          ticketId: ticketBySubject?.id || null,
          erro: subjectError?.message || null
        });
        
        if (ticketBySubject) {
          console.log("[inbound-email] ✅ Ticket encontrado por subject:", ticketBySubject.id);
          
          // Processar anexos do email
          const savedAttachments = await processEmailAttachments(supabase, ticketBySubject.id, attachments);
          
          // Adicionar como comentário no ticket (com anexos)
          const { error: commentError } = await supabase.from("ticket_comments").insert({
            ticket_id: ticketBySubject.id,
            content: emailContent,
            created_by: null, // Comentário do cliente
            is_internal: false,
            source: "email_reply",
            attachments: savedAttachments.length > 0 ? savedAttachments : null,
          });

          if (commentError) {
            console.error("[inbound-email] Erro ao inserir comentário:", commentError);
          } else {
            console.log("[inbound-email] ✅ Comentário adicionado ao ticket via subject match", savedAttachments.length > 0 ? `com ${savedAttachments.length} anexo(s)` : "");
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
              metadata: {
                ticket_id: ticketBySubject.id,
                ticket_number: ticketBySubject.ticket_number || null,
                action_url: `/support?ticket=${ticketBySubject.id}`,
              },
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
    
    console.log("[inbound-email] Nenhum ticket existente encontrado, continuando fluxo normal...");

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
          subject: (subject || "Email sem assunto").replace(/^re:\s*/i, "").trim(),
          description: emailContent,
          channel: "email",
          status: "open",
          priority: "medium",
          department_id: supportDept.id,
          source_conversation_id: conversationId,
          last_email_message_id: messageId || null,
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