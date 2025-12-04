import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BulkTriggerRequest {
  contactIds: string[];
  playbookId: string;
  skipExisting: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { contactIds, playbookId, skipExisting }: BulkTriggerRequest = await req.json();

    if (!contactIds?.length || !playbookId) {
      return new Response(
        JSON.stringify({ error: "contactIds and playbookId are required" }),
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
    const errors: string[] = [];

    // Create tracking job
    const { data: job } = await supabase
      .from("sync_jobs")
      .insert({
        type: "bulk_playbook_trigger",
        status: "processing",
        metadata: { playbookId, playbookName: playbook.name, totalContacts: contactIds.length },
      })
      .select()
      .single();

    const jobId = job?.id;

    // Get existing executions if skipExisting
    let existingExecutions: Set<string> = new Set();
    if (skipExisting) {
      const { data: existing } = await supabase
        .from("playbook_executions")
        .select("contact_id")
        .eq("playbook_id", playbookId)
        .in("contact_id", contactIds);

      existingExecutions = new Set((existing || []).map(e => e.contact_id));
    }

    // Process contacts
    for (const contactId of contactIds) {
      try {
        // Skip if already has execution
        if (skipExisting && existingExecutions.has(contactId)) {
          skipped++;
          continue;
        }

        // Get first node from flow
        const flowDefinition = playbook.flow_definition as any;
        const nodes = flowDefinition?.nodes || [];
        const firstNode = nodes.find((n: any) => n.type !== "start") || nodes[0];

        if (!firstNode) {
          errors.push(`Contact ${contactId}: No valid start node in playbook`);
          continue;
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
          errors.push(`Contact ${contactId}: ${execError.message}`);
          continue;
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
          content: `Playbook "${playbook.name}" iniciado via disparo em massa`,
          channel: "other",
          metadata: { playbook_id: playbookId, trigger: "bulk_action", job_id: jobId },
        });

        processed++;

        // Rate limit - wait 200ms between each
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err: any) {
        errors.push(`Contact ${contactId}: ${err.message}`);
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
            processed,
            skipped,
            errors: errors.length,
          },
        })
        .eq("id", jobId);
    }

    console.log(`Bulk trigger completed: ${processed} processed, ${skipped} skipped, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        total: contactIds.length,
        processed,
        skipped,
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
