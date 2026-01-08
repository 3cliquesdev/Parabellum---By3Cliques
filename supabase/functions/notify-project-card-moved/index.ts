import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyRequest {
  card_id: string;
  old_column_id: string | null;
  new_column_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { card_id, old_column_id, new_column_id }: NotifyRequest = await req.json();
    console.log("[notify-project-card-moved] Received:", { card_id, old_column_id, new_column_id });

    if (!card_id || !new_column_id) {
      throw new Error("card_id and new_column_id are required");
    }

    // Skip if column didn't change
    if (old_column_id === new_column_id) {
      console.log("[notify-project-card-moved] Column unchanged, skipping");
      return new Response(JSON.stringify({ success: true, action: "skipped" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get new column details
    const { data: newColumn, error: columnError } = await supabase
      .from("project_columns")
      .select("*, board:project_boards(*, contact:contacts(id, first_name, last_name, email))")
      .eq("id", new_column_id)
      .single();

    if (columnError || !newColumn) {
      console.error("[notify-project-card-moved] Column not found:", columnError);
      throw new Error("Column not found");
    }

    console.log("[notify-project-card-moved] Column details:", {
      name: newColumn.name,
      is_final: newColumn.is_final,
      notify_client_on_enter: newColumn.notify_client_on_enter,
      email_template_id: newColumn.email_template_id,
    });

    // Check if we should notify
    if (!newColumn.notify_client_on_enter) {
      console.log("[notify-project-card-moved] notify_client_on_enter is false, skipping");
      return new Response(JSON.stringify({ success: true, action: "skipped" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get card details
    const { data: card, error: cardError } = await supabase
      .from("project_cards")
      .select("*")
      .eq("id", card_id)
      .single();

    if (cardError || !card) {
      console.error("[notify-project-card-moved] Card not found:", cardError);
      throw new Error("Card not found");
    }

    const board = newColumn.board;
    const contact = board?.contact;

    if (!contact?.email) {
      console.log("[notify-project-card-moved] No contact email, skipping notification");
      return new Response(JSON.stringify({ success: true, action: "skipped_no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build email content
    let emailSubject = `Atualização do projeto: ${board.name}`;
    let emailHtml = "";

    // Check if there's an email template configured
    if (newColumn.email_template_id) {
      const { data: template } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", newColumn.email_template_id)
        .single();

      if (template) {
        emailSubject = template.subject
          .replace(/{{contact_name}}/g, `${contact.first_name} ${contact.last_name}`)
          .replace(/{{project_name}}/g, board.name)
          .replace(/{{card_title}}/g, card.title)
          .replace(/{{column_name}}/g, newColumn.name);

        emailHtml = template.body
          .replace(/{{contact_name}}/g, `${contact.first_name} ${contact.last_name}`)
          .replace(/{{project_name}}/g, board.name)
          .replace(/{{card_title}}/g, card.title)
          .replace(/{{column_name}}/g, newColumn.name);
      }
    }

    // Default email if no template
    if (!emailHtml) {
      const isCompleted = newColumn.is_final;
      
      if (isCompleted) {
        emailSubject = `🎉 Projeto "${board.name}" concluído!`;
        emailHtml = `
          <p>Olá <strong>${contact.first_name}</strong>,</p>
          <p>Temos ótimas notícias! O projeto <strong>${board.name}</strong> foi concluído com sucesso.</p>
          <p>A tarefa "<strong>${card.title}</strong>" foi finalizada e está agora na etapa "${newColumn.name}".</p>
          <p>Agradecemos pela confiança em nosso trabalho!</p>
          <p>Atenciosamente,<br>Equipe de Projetos</p>
        `;
      } else {
        emailSubject = `📋 Atualização do projeto "${board.name}"`;
        emailHtml = `
          <p>Olá <strong>${contact.first_name}</strong>,</p>
          <p>Gostaríamos de informar que houve uma atualização no seu projeto.</p>
          <p>A tarefa "<strong>${card.title}</strong>" avançou para a etapa "<strong>${newColumn.name}</strong>".</p>
          <p>Continue acompanhando o progresso do seu projeto!</p>
          <p>Atenciosamente,<br>Equipe de Projetos</p>
        `;
      }
    }

    // Send email via send-email function
    console.log("[notify-project-card-moved] Sending email to:", contact.email);
    
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        to: contact.email,
        to_name: `${contact.first_name} ${contact.last_name}`,
        subject: emailSubject,
        html: emailHtml,
        customer_id: contact.id,
        is_customer_email: true,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("[notify-project-card-moved] Email result:", emailResult);

    if (!emailResult.success) {
      console.error("[notify-project-card-moved] Email failed:", emailResult.error);
      throw new Error(`Email failed: ${emailResult.error}`);
    }

    // Log the notification in comments
    await supabase.from("project_card_comments").insert({
      card_id,
      content: `📧 Notificação enviada para ${contact.email} sobre entrada na coluna "${newColumn.name}"`,
      is_system: true,
    });

    console.log("[notify-project-card-moved] Notification sent successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        action: "notified",
        email_id: emailResult.email_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[notify-project-card-moved] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
