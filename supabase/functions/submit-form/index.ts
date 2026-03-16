import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Resend helper (inline to avoid CDN issues)
class Resend {
  private apiKey: string;
  constructor(apiKey: string | undefined) {
    this.apiKey = apiKey || "";
  }
  emails = {
    send: async (options: { from: string; to: string[]; bcc?: string[]; subject: string; html: string }) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      const data = await res.json();
      return { data, error: res.ok ? null : data };
    }
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FormSubmission {
  form_id: string;
  answers: Record<string, any>;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  attachments?: { field_id: string; url: string; filename: string }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { form_id, answers, email, first_name, last_name, phone, attachments }: FormSubmission = await req.json();

    // Validate required fields
    if (!form_id || !email || !first_name || !last_name) {
      return new Response(
        JSON.stringify({ success: false, error: "Campos obrigatórios faltando" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing form submission: ${form_id} from ${email}`);

    // 1. Fetch form configuration
    const { data: form, error: formError } = await supabase
      .from("forms")
      .select("*")
      .eq("id", form_id)
      .single();

    if (formError || !form) {
      console.error("Form not found:", formError);
      return new Response(
        JSON.stringify({ success: false, error: "Formulário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Upsert contact using existing function
    const { data: contactResult, error: contactError } = await supabase.rpc(
      "upsert_contact_with_interaction",
      {
        p_email: email,
        p_first_name: first_name,
        p_last_name: last_name,
        p_phone: phone || null,
        p_source: "form",
      }
    );

    if (contactError) {
      console.error("Contact upsert error:", contactError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao criar contato" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contact_id = contactResult?.[0]?.contact_id;
    const is_new_contact = contactResult?.[0]?.is_new_contact;

    console.log(`Contact ${is_new_contact ? "created" : "updated"}: ${contact_id}`);

    // 3. Determine assignee based on distribution rule
    let assigned_to: string | null = null;
    let pipeline_id: string | undefined = undefined;
    
    // Field-based routing: look up answer in mappings
    if (form.distribution_rule === "field_based") {
      const routingFieldId = form.routing_field_id;
      const mappings = form.routing_field_mappings;
      if (routingFieldId && mappings) {
        const userAnswer = answers[routingFieldId];
        assigned_to = mappings[userAnswer] || null;
        console.log(`[submit-form] Field-based routing: field=${routingFieldId}, answer=${userAnswer}, assigned_to=${assigned_to}`);
      }
    } else {
      // Determinar o pipeline_id para round robin
      pipeline_id = form.target_pipeline_id;
      if (!pipeline_id && form.target_type === "deal") {
        const { data: defaultPipeline } = await supabase
          .from("pipelines")
          .select("id")
          .eq("is_default", true)
          .single();
        pipeline_id = defaultPipeline?.id;
      }

      if (form.distribution_rule === "round_robin" && pipeline_id) {
        const { data: leastLoaded, error: rpcError } = await supabase.rpc(
          "get_least_loaded_sales_rep_for_pipeline",
          { p_pipeline_id: pipeline_id }
        );
        
        if (rpcError) {
          console.error("Error getting least loaded sales rep:", rpcError);
        }
        
        assigned_to = leastLoaded || null;
        console.log(`Round robin assignment for pipeline ${pipeline_id}: ${assigned_to || 'none'}`);
        
      } else if (form.distribution_rule === "manager_only" && form.target_department_id) {
        const { data: managers } = await supabase
          .from("profiles")
          .select("id")
          .eq("department", form.target_department_id)
          .limit(1);
        assigned_to = managers?.[0]?.id || null;
        
      } else if (form.distribution_rule === "specific_user" && form.target_user_id) {
        assigned_to = form.target_user_id;
      }
    }

    // 4. Route based on target_type
    let created_record: any = null;
    const schema = form.schema || {};
    const ticketSettings = schema.ticket_settings || {};

    // Guardar pipeline_id fora do bloco else para uso posterior
    let resolvedPipelineId: string | null = null;
    if (form.distribution_rule !== "field_based") {
      resolvedPipelineId = form.target_pipeline_id || null;
      if (!resolvedPipelineId && form.target_type === "deal") {
        const { data: defPipe } = await supabase.from("pipelines").select("id").eq("is_default", true).single();
        resolvedPipelineId = defPipe?.id || null;
      }
    }

    if (form.target_type === "deal") {
      const dealPipelineId = resolvedPipelineId;

      // Verificar se já existe deal aberto para este contato no mesmo pipeline
      const { data: existingDeal } = await supabase
        .from("deals")
        .select("id")
        .eq("contact_id", contact_id)
        .eq("status", "open")
        .eq("pipeline_id", dealPipelineId)
        .maybeSingle();

      if (existingDeal) {
        console.log("[submit-form] Deal já existe para este contato:", existingDeal.id);
        created_record = { type: "deal", id: existingDeal.id, existing: true };
      } else {
        const { data: firstStage } = await supabase
          .from("stages")
          .select("id")
          .eq("pipeline_id", dealPipelineId)
          .order("position", { ascending: true })
          .limit(1)
          .single();

        const { data: deal, error: dealError } = await supabase
          .from("deals")
          .insert({
            title: `Lead via Formulário: ${first_name} ${last_name}`,
            contact_id: contact_id,
            pipeline_id: dealPipelineId,
            stage_id: firstStage?.id,
            assigned_to: assigned_to,
            lead_source: "formulario",
            lead_email: email,
            lead_phone: phone,
            status: "open",
          })
          .select()
          .single();

        if (dealError) {
          console.error("Deal creation error:", dealError);
        } else {
          created_record = { type: "deal", id: deal.id };
          console.log("Deal created:", deal.id);
        }
      }

    } else if (form.target_type === "ticket") {
      // ============= TICKET CREATION =============
      
      // Extract subject and description from field mappings or answers
      const fields = schema.fields || [];
      const subjectField = fields.find((f: any) => f.ticket_field === "subject");
      const descriptionField = fields.find((f: any) => f.ticket_field === "description");

      // Build subject
      let subject = `Solicitação via Formulário: ${form.name}`;
      if (subjectField && answers[subjectField.id]) {
        subject = String(answers[subjectField.id]);
      }

      // Build description
      let description = "";
      if (descriptionField && answers[descriptionField.id]) {
        description = String(answers[descriptionField.id]);
      } else {
        // Concatenate all answers
        const answerLines = Object.entries(answers).map(([fieldId, value]) => {
          const field = fields.find((f: any) => f.id === fieldId);
          const label = field?.label || fieldId;
          return `**${label}:** ${value}`;
        });
        description = answerLines.join("\n\n");
      }

      // Add attachments info to description if present
      if (attachments && attachments.length > 0) {
        description += "\n\n---\n**Anexos:**\n";
        attachments.forEach(att => {
          description += `- [${att.filename}](${att.url})\n`;
        });
      }

      // Get priority
      const priority = ticketSettings.default_priority || "medium";
      const category = ticketSettings.default_category || "outro";

      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          subject: subject,
          description: description,
          contact_id: contact_id,
          department_id: form.target_department_id,
          assigned_to: assigned_to,
          priority: priority,
          category: category,
          status: "open",
          source: "form",
          attachments: attachments || [],
        })
        .select("*, ticket_number")
        .single();

      if (ticketError) {
        console.error("Ticket creation error:", ticketError);
      } else {
        created_record = { type: "ticket", id: ticket.id, ticket_number: ticket.ticket_number };
        console.log("Ticket created:", ticket.id, "Number:", ticket.ticket_number);

        // ============= AUTO-REPLY EMAIL =============
        if (ticketSettings.send_auto_reply !== false) {
          try {
            const resendApiKey = Deno.env.get("RESEND_API_KEY");
            if (resendApiKey) {
              const resend = new Resend(resendApiKey);
              
              // Get sender config
              const { data: senderConfig } = await supabase
                .from("system_configurations")
                .select("value")
                .eq("key", "email_sender_customer")
                .single();

              const senderEmail = senderConfig?.value || "suporte@resend.dev";

              // Build auto-reply message
              let autoReplyMessage = ticketSettings.auto_reply_template || 
                "Recebemos sua solicitação. Ticket #{{ticket_number}} criado. Nossa equipe entrará em contato em breve.";
              
              autoReplyMessage = autoReplyMessage
                .replace("{{ticket_number}}", ticket.ticket_number || ticket.id.substring(0, 8))
                .replace("{{customer_name}}", `${first_name} ${last_name}`)
                .replace("{{subject}}", subject);

              await resend.emails.send({
                from: `Suporte <${senderEmail}>`,
                to: [email],
                subject: `Ticket #${ticket.ticket_number || ticket.id.substring(0, 8)} - Recebemos sua solicitação`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Sua solicitação foi recebida!</h2>
                    <p>Olá ${first_name},</p>
                    <p>${autoReplyMessage}</p>
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                      <p style="margin: 0;"><strong>Número do Ticket:</strong> #${ticket.ticket_number || ticket.id.substring(0, 8)}</p>
                      <p style="margin: 8px 0 0;"><strong>Assunto:</strong> ${subject}</p>
                    </div>
                    <p>Nossa equipe analisará sua solicitação e responderá o mais breve possível.</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                    <p style="color: #6b7280; font-size: 12px;">
                      Este é um e-mail automático. Por favor, não responda diretamente.
                    </p>
                  </div>
                `,
              });
              console.log("Auto-reply email sent to:", email);
            }
          } catch (emailError) {
            console.error("Auto-reply email error:", emailError);
            // Don't fail the submission if email fails
          }
        }
      }

    } else if (form.target_type === "internal_request") {
      const { data: activity, error: activityError } = await supabase
        .from("activities")
        .insert({
          title: `Solicitação Interna: ${form.name}`,
          description: `Origem: ${first_name} ${last_name} (${email})\n\nRespostas:\n${JSON.stringify(answers, null, 2)}`,
          type: "task",
          contact_id: contact_id,
          assigned_to: assigned_to,
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (activityError) {
        console.error("Activity creation error:", activityError);
      } else {
        created_record = { type: "activity", id: activity.id };
        console.log("Activity created:", activity.id);
      }
    }

    // 5. Notify manager if enabled
    if (form.notify_manager && form.target_department_id) {
      const alertTitle = form.target_type === "ticket" 
        ? `Novo ticket via formulário "${form.name}"`
        : `Novo lead via formulário "${form.name}"`;

      await supabase.from("admin_alerts").insert({
        type: form.target_type === "ticket" ? "new_ticket" : "new_lead",
        title: alertTitle,
        message: `${first_name} ${last_name} (${email}) enviou o formulário.`,
        metadata: {
          form_id: form.id,
          form_name: form.name,
          contact_id: contact_id,
          created_record: created_record,
        },
      });
    }

    // 6. Log interaction
    await supabase.from("interactions").insert({
      customer_id: contact_id,
      type: "form_submission",
      content: `Formulário "${form.name}" enviado`,
      channel: "form",
      metadata: {
        form_id: form.id,
        answers: answers,
        created_record: created_record,
        attachments: attachments,
      },
    });

    // Build success message
    let successMessage = is_new_contact
      ? "Obrigado pelo seu interesse! Entraremos em contato em breve."
      : "Obrigado por voltar! Suas informações foram atualizadas.";

    if (form.target_type === "ticket" && created_record) {
      successMessage = `Sua solicitação foi registrada com sucesso. Ticket #${created_record.ticket_number || created_record.id.substring(0, 8)} criado.`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        contact_id,
        is_new_contact,
        created_record,
        message: successMessage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Form submission error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno ao processar formulário" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
