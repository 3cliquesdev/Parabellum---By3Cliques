import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { form_id, answers, email, first_name, last_name, phone }: FormSubmission = await req.json();

    // Validate required fields
    if (!form_id || !email || !first_name || !last_name) {
      return new Response(
        JSON.stringify({ success: false, error: "Campos obrigatórios faltando" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
    let assigned_to = form.target_user_id;

    if (form.distribution_rule === "round_robin") {
      // Get least loaded sales rep
      const { data: leastLoaded } = await supabase.rpc("get_least_loaded_sales_rep");
      assigned_to = leastLoaded || form.target_user_id;
    } else if (form.distribution_rule === "manager_only" && form.target_department_id) {
      // Get department manager (first admin/manager in department)
      const { data: managers } = await supabase
        .from("profiles")
        .select("id")
        .eq("department", form.target_department_id)
        .limit(1);
      assigned_to = managers?.[0]?.id || form.target_user_id;
    }

    // 4. Route based on target_type
    let created_record = null;

    if (form.target_type === "deal") {
      // Get first stage of target pipeline
      let pipeline_id = form.target_pipeline_id;
      
      if (!pipeline_id) {
        // Get default pipeline
        const { data: defaultPipeline } = await supabase
          .from("pipelines")
          .select("id")
          .eq("is_default", true)
          .single();
        pipeline_id = defaultPipeline?.id;
      }

      // Get first stage
      const { data: firstStage } = await supabase
        .from("stages")
        .select("id")
        .eq("pipeline_id", pipeline_id)
        .order("position", { ascending: true })
        .limit(1)
        .single();

      // Create deal
      const { data: deal, error: dealError } = await supabase
        .from("deals")
        .insert({
          title: `Lead via Formulário: ${first_name} ${last_name}`,
          contact_id: contact_id,
          pipeline_id: pipeline_id,
          stage_id: firstStage?.id,
          assigned_to: assigned_to,
          lead_source: "form",
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
    } else if (form.target_type === "ticket") {
      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          subject: `Solicitação via Formulário: ${form.name}`,
          description: `Respostas do formulário:\n${JSON.stringify(answers, null, 2)}`,
          contact_id: contact_id,
          department_id: form.target_department_id,
          assigned_to: assigned_to,
          priority: "medium",
          status: "open",
          source: "form",
        })
        .select()
        .single();

      if (ticketError) {
        console.error("Ticket creation error:", ticketError);
      } else {
        created_record = { type: "ticket", id: ticket.id };
        console.log("Ticket created:", ticket.id);
      }
    } else if (form.target_type === "internal_request") {
      // Create activity as internal request
      const { data: activity, error: activityError } = await supabase
        .from("activities")
        .insert({
          title: `Solicitação Interna: ${form.name}`,
          description: `Origem: ${first_name} ${last_name} (${email})\n\nRespostas:\n${JSON.stringify(answers, null, 2)}`,
          type: "task",
          contact_id: contact_id,
          assigned_to: assigned_to,
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // +24h
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
      // Create admin alert
      await supabase.from("admin_alerts").insert({
        type: "new_lead",
        title: `Novo lead via formulário "${form.name}"`,
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
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        contact_id,
        is_new_contact,
        created_record,
        message: is_new_contact
          ? "Obrigado pelo seu interesse! Entraremos em contato em breve."
          : "Obrigado por voltar! Suas informações foram atualizadas.",
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