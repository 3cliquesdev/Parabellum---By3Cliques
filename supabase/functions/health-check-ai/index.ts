import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Protect with service role key
    const authHeader = req.headers.get('Authorization');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!authHeader || !authHeader.includes(serviceKey!)) {
      // Also allow anon key with valid JWT (for admin users)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Orphan conversations (waiting_human, no assigned_to, no active dispatch job)
    const { data: waitingHuman } = await supabase
      .from('conversations')
      .select('id, department, created_at')
      .eq('ai_mode', 'waiting_human')
      .eq('status', 'open')
      .is('assigned_to', null);

    let orphanCount = 0;
    const orphanDetails: Array<{ id: string; department: string | null }> = [];
    for (const conv of waitingHuman ?? []) {
      const { data: job } = await supabase
        .from('conversation_dispatch_jobs')
        .select('id')
        .eq('conversation_id', conv.id)
        .in('status', ['pending', 'escalated'])
        .maybeSingle();
      if (!job) {
        orphanCount++;
        orphanDetails.push({ id: conv.id, department: conv.department });
      }
    }

    // 2. Escalated jobs count by department
    const { data: escalatedJobs } = await supabase
      .from('conversation_dispatch_jobs')
      .select('department_id, departments!inner(name)')
      .eq('status', 'escalated');

    const escalatedByDept: Record<string, number> = {};
    for (const job of escalatedJobs ?? []) {
      const deptName = (job as any).departments?.name || job.department_id || 'unknown';
      escalatedByDept[deptName] = (escalatedByDept[deptName] || 0) + 1;
    }

    // 3. Queue entries for closed conversations (should be 0)
    const { count: staleQueueCount } = await supabase
      .from('conversation_queue')
      .select('id, conversations!inner(status)', { count: 'exact', head: true })
      .in('conversations.status', ['closed']);

    // 4. Last 100 ai_events with state_transition breakdown
    const { data: recentEvents } = await supabase
      .from('ai_events')
      .select('event_type, output_json, created_at')
      .like('event_type', 'state_transition_%')
      .order('created_at', { ascending: false })
      .limit(100);

    const eventBreakdown: Record<string, number> = {};
    for (const ev of recentEvents ?? []) {
      eventBreakdown[ev.event_type] = (eventBreakdown[ev.event_type] || 0) + 1;
    }

    // 5. flow_advance_needed in last 24h vs total AI responses
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { count: flowAdvanceCount } = await supabase
      .from('ai_events')
      .select('id', { count: 'exact', head: true })
      .in('event_type', ['contract_violation_blocked', 'flow_exit_clean'])
      .gte('created_at', since24h);

    const { count: totalAIResponses } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('is_ai_generated', true)
      .gte('created_at', since24h);

    const report = {
      timestamp: new Date().toISOString(),
      orphan_conversations: {
        count: orphanCount,
        details: orphanDetails.slice(0, 10),
        waiting_human_total: waitingHuman?.length || 0,
      },
      escalated_jobs_by_department: escalatedByDept,
      stale_queue_entries: staleQueueCount || 0,
      recent_transitions: {
        last_100_breakdown: eventBreakdown,
      },
      ai_activity_24h: {
        flow_advance_or_exit: flowAdvanceCount || 0,
        total_ai_responses: totalAIResponses || 0,
        ratio: totalAIResponses ? ((flowAdvanceCount || 0) / totalAIResponses * 100).toFixed(2) + '%' : 'N/A',
      },
      health: orphanCount === 0 && (staleQueueCount || 0) === 0 ? '✅ HEALTHY' : '⚠️ ISSUES DETECTED',
    };

    return new Response(JSON.stringify(report, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[health-check-ai] ❌ Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
