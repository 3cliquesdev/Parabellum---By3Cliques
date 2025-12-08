import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BulkTriggerRequest {
  contactIds: string[];
  dealIds?: string[];
  playbookId: string;
  skipExisting?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { contactIds = [], dealIds = [], playbookId, skipExisting = true }: BulkTriggerRequest = await req.json();

    if ((!contactIds?.length && !dealIds?.length) || !playbookId) {
      return new Response(
        JSON.stringify({ error: "contactIds/dealIds and playbookId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch playbook
    const { data: playbook, error: playbookError } = await supabase
      .from("onboarding_playbooks")
      .select("*")
      .eq("id", playbookId)
      .single();

    if (playbookError || !playbook) {
      return new Response(
        JSON.stringify({ error: "Playbook not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let skipped = 0;
    let processed = 0;
    let leadsConverted = 0;
    const errors: string[] = [];
    const totalItems = contactIds.length + dealIds.length;

    // Create tracking job
    const { data: job } = await supabase
      .from("sync_jobs")
      .insert({
        type: "bulk_playbook_trigger",
        status: "processing",
        metadata: { 
          playbookId, 
          playbookName: playbook.name, 
          totalContacts: contactIds.length,
          totalLeads: dealIds.length,
          totalItems,
        },
      })
      .select()
      .single();

    const jobId = job?.id;

    // Get existing executions if skipExisting (only for contacts)
    let existingExecutions: Set<string> = new Set();
    if (skipExisting && contactIds.length > 0) {
      const { data: existing } = await supabase
        .from("playbook_executions")
        .select("contact_id")
        .eq("playbook_id", playbookId)
        .in("contact_id", contactIds);

      existingExecutions = new Set((existing || []).map(e => e.contact_id));
    }

    // Helper function to process a contact
    async function processContact(contactId: string, source: 'contact' | 'lead_converted') {
      // Get first node from flow
      const flowDefinition = playbook.flow_definition as any;
      const nodes = flowDefinition?.nodes || [];
      const firstNode = nodes.find((n: any) => n.type !== "start") || nodes[0];

      if (!firstNode) {
        throw new Error("No valid start node in playbook");
      }

      // Create execution
      const { data: execution, error: execError } = await supabase
        .from("playbook_executions")
        .insert({
          playbook_id: playbookId,
          contact_id: contactId,
          status: "running",
          current_node_id: firstNode.id,
          execution_history: [{ nodeId: "start", timestamp: new Date().toISOString() }],
        })
        .select()
        .single();

      if (execError) {
        throw new Error(execError.message);
      }

      // Queue first node
      await supabase.from("playbook_execution_queue").insert({
        execution_id: execution.id,
        node_id: firstNode.id,
        node_type: firstNode.type,
        node_data: firstNode.data,
        scheduled_for: new Date().toISOString(),
        status: "pending",
      });

      // Log interaction
      await supabase.from("interactions").insert({
        customer_id: contactId,
        type: "note",
        content: `Playbook "${playbook.name}" iniciado via disparo em massa${source === 'lead_converted' ? ' (lead convertido)' : ''}`,
        channel: "other",
        metadata: { playbook_id: playbookId, trigger: "bulk_action", job_id: jobId, source },
      });
    }

    // Process existing contacts
    for (const contactId of contactIds) {
      try {
        // Skip if already has execution
        if (skipExisting && existingExecutions.has(contactId)) {
          skipped++;
          continue;
        }

        await processContact(contactId, 'contact');
        processed++;

        // Rate limit - wait 200ms between each
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err: any) {
        errors.push(`Contact ${contactId}: ${err.message}`);
      }
    }

    // Process leads (deals without contact_id) - convert to contacts first
    for (const dealId of dealIds) {
      try {
        // Fetch deal data
        const { data: deal, error: dealError } = await supabase
          .from("deals")
          .select("id, title, lead_email, lead_phone, contact_id")
          .eq("id", dealId)
          .single();

        if (dealError || !deal) {
          errors.push(`Deal ${dealId}: Deal not found`);
          continue;
        }

        // If deal already has a contact, use it
        if (deal.contact_id) {
          if (skipExisting && existingExecutions.has(deal.contact_id)) {
            skipped++;
            continue;
          }
          await processContact(deal.contact_id, 'contact');
          processed++;
          await new Promise(resolve => setTimeout(resolve, 200));
          continue;
        }

        // Create contact from lead data
        const leadName = deal.title?.split(' - ').slice(1).join(' - ') || deal.title || 'Lead';
        const nameParts = leadName.split(' ');
        const firstName = nameParts[0] || 'Lead';
        const lastName = nameParts.slice(1).join(' ') || '';

        const { data: newContact, error: contactError } = await supabase
          .from("contacts")
          .insert({
            first_name: firstName,
            last_name: lastName,
            email: deal.lead_email,
            phone: deal.lead_phone,
            status: "lead",
            source: "bulk_trigger_conversion",
          })
          .select()
          .single();

        if (contactError) {
          errors.push(`Deal ${dealId}: Failed to create contact - ${contactError.message}`);
          continue;
        }

        // Update deal with contact_id
        await supabase
          .from("deals")
          .update({ contact_id: newContact.id })
          .eq("id", dealId);

        // Process the new contact
        await processContact(newContact.id, 'lead_converted');
        processed++;
        leadsConverted++;

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err: any) {
        errors.push(`Deal ${dealId}: ${err.message}`);
      }
    }

    // Update job status
    if (jobId) {
      await supabase
        .from("sync_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          metadata: {
            playbookId,
            playbookName: playbook.name,
            totalContacts: contactIds.length,
            totalLeads: dealIds.length,
            totalItems,
            processed,
            skipped,
            leadsConverted,
            errors: errors.length,
          },
        })
        .eq("id", jobId);
    }

    console.log(`Bulk trigger completed: ${processed} processed, ${skipped} skipped, ${leadsConverted} leads converted, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        total: totalItems,
        processed,
        skipped,
        leadsConverted,
        errors: errors.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in bulk-trigger-playbook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
