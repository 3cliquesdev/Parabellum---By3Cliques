import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("🔍 [SLA Check] Starting SLA violation check...");

    // STEP 1: Find conversations violating FRT SLA (>10 minutes without first_response_at)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: violations, error: violationsError } = await supabase
      .from('conversations')
      .select('id, contact_id, department, created_at, contacts(first_name, last_name)')
      .eq('status', 'open')
      .is('first_response_at', null)
      .lt('created_at', tenMinutesAgo);

    if (violationsError) {
      console.error("❌ Error fetching violations:", violationsError);
      throw violationsError;
    }

    console.log(`📊 Found ${violations?.length || 0} conversations without response`);

    let newAlertsCreated = 0;

    // STEP 2: For each violation, check if alert already exists
    for (const conversation of violations || []) {
      const { data: existingAlert } = await supabase
        .from('sla_alerts')
        .select('id')
        .eq('conversation_id', conversation.id)
        .eq('status', 'active')
        .maybeSingle();

      if (existingAlert) {
        console.log(`⏭️ Alert already exists for conversation ${conversation.id}`);
        continue;
      }

      // Calculate actual minutes waiting
      const createdAt = new Date(conversation.created_at);
      const actualMinutes = Math.floor((Date.now() - createdAt.getTime()) / 60000);

      // Create alert
      const { data: newAlert, error: alertError } = await supabase
        .from('sla_alerts')
        .insert({
          conversation_id: conversation.id,
          alert_type: 'frt_violation',
          threshold_minutes: 10,
          actual_minutes: actualMinutes,
          status: 'active'
        })
        .select()
        .single();

      if (alertError) {
        console.error(`❌ Error creating alert for conversation ${conversation.id}:`, alertError);
        continue;
      }

      console.log(`✅ Created alert for conversation ${conversation.id} (${actualMinutes} min)`);
      newAlertsCreated++;

      // STEP 3: Notify managers (email via Resend API)
      const { data: managers, error: managersError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['admin', 'manager'])
          .then(({ data }) => data?.map(r => r.user_id) || [])
        );

      if (!managersError && managers) {
        // Send email notification (implement when Resend is configured)
        console.log(`📧 Would notify ${managers.length} managers about alert ${newAlert.id}`);
      }
    }

    // STEP 4: Auto-resolve alerts where first_response_at was set
    const { data: activeAlerts } = await supabase
      .from('sla_alerts')
      .select('id, conversation_id')
      .eq('status', 'active');

    let alertsResolved = 0;

    for (const alert of activeAlerts || []) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('first_response_at')
        .eq('id', alert.conversation_id)
        .single();

      if (conversation?.first_response_at) {
        await supabase
          .from('sla_alerts')
          .update({ 
            status: 'resolved',
            resolved_at: new Date().toISOString()
          })
          .eq('id', alert.id);

        console.log(`✅ Auto-resolved alert ${alert.id}`);
        alertsResolved++;
      }
    }

    console.log(`🎯 [SLA Check] Summary: ${newAlertsCreated} new alerts, ${alertsResolved} resolved`);

    return new Response(
      JSON.stringify({
        success: true,
        newAlerts: newAlertsCreated,
        resolvedAlerts: alertsResolved
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error("❌ [SLA Check] Fatal error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});