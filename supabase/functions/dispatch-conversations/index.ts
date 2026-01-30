import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DispatchJob {
  id: string;
  conversation_id: string;
  department_id: string | null;
  priority: number;
  attempts: number;
  max_attempts: number;
  status: string;
}

interface EligibleAgent {
  id: string;
  full_name: string;
  max_chats: number;
  active_chats: number;
  last_status_change: string;
}

/**
 * Enterprise Conversation Dispatcher
 * 
 * Processes pending dispatch jobs and assigns conversations to eligible agents
 * using a Round-Robin Least-Loaded algorithm with atomic locking.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // deno-lint-ignore no-explicit-any
    const supabase: any = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[dispatch-conversations] Starting dispatch cycle...');

    // 1. Fetch pending jobs (LIMIT 50 for performance)
    const { data: pendingJobs, error: jobsError } = await supabase
      .from('conversation_dispatch_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('next_attempt_at', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(50);

    if (jobsError) {
      console.error('[dispatch-conversations] Error fetching jobs:', jobsError);
      throw jobsError;
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('[dispatch-conversations] No pending jobs to process');
      return new Response(JSON.stringify({ 
        processed: 0, 
        assigned: 0, 
        failed: 0,
        duration_ms: Date.now() - startTime 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[dispatch-conversations] Found ${pendingJobs.length} pending jobs`);

    let assigned = 0;
    let failed = 0;
    const results: Array<{ conversation_id: string; status: string; agent?: string; reason?: string }> = [];

    // 2. Process each job
    for (const job of pendingJobs as DispatchJob[]) {
      const jobStartTime = Date.now();
      
      try {
        // D3.1: Lock atômico - só processa se conseguir marcar como processing
        const { data: lockedJob, error: lockError } = await supabase
          .from('conversation_dispatch_jobs')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', job.id)
          .eq('status', 'pending') // Só se ainda for pending
          .select('*')
          .maybeSingle();

        if (lockError) {
          console.error(`[dispatch-conversations] Lock error for job ${job.id}:`, lockError);
          continue;
        }

        if (!lockedJob) {
          // Outro worker já pegou este job - pular
          console.log(`[dispatch-conversations] Job ${job.id} already picked by another worker`);
          continue;
        }

        // 2a. Verify conversation still needs assignment
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .select('id, ai_mode, assigned_to, department, status')
          .eq('id', job.conversation_id)
          .single();

        if (convError || !conversation) {
          console.log(`[dispatch-conversations] Conversation ${job.conversation_id} not found, marking complete`);
          await markJobComplete(supabase, job.id, 'conversation_not_found');
          continue;
        }

        // If already assigned or not waiting_human, skip
        if (conversation.assigned_to || conversation.ai_mode !== 'waiting_human') {
          console.log(`[dispatch-conversations] Conversation ${job.conversation_id} already handled`);
          await markJobComplete(supabase, job.id, 'already_assigned');
          continue;
        }

        // If status is not open, skip
        if (conversation.status !== 'open') {
          console.log(`[dispatch-conversations] Conversation ${job.conversation_id} not open (${conversation.status})`);
          await markJobComplete(supabase, job.id, 'not_open');
          continue;
        }

        const departmentId = job.department_id || conversation.department;
        
        if (!departmentId) {
          console.log(`[dispatch-conversations] No department for conversation ${job.conversation_id}`);
          await handleJobFailure(supabase, job, 'no_department');
          failed++;
          results.push({ conversation_id: job.conversation_id, status: 'failed', reason: 'no_department' });
          continue;
        }

        // 2b. Find eligible agents with capacity (Round-Robin Least-Loaded)
        const eligibleAgent = await findEligibleAgent(supabase, departmentId);

        if (!eligibleAgent) {
          console.log(`[dispatch-conversations] No eligible agents for dept ${departmentId}`);
          
          // D4.1: Verificar se o departamento tem ALGUM agente configurado
          const hasAnyAgents = await checkDepartmentHasAgents(supabase, departmentId);
          
          if (!hasAnyAgents) {
            // Departamento não tem agentes configurados → manual_only
            console.log(`[dispatch-conversations] Department ${departmentId} has no configured agents, marking manual_only`);
            await supabase.from('conversations').update({
              dispatch_status: 'manual_only'
            }).eq('id', job.conversation_id);
            
            await markJobComplete(supabase, job.id, 'no_agents_configured');
            results.push({ conversation_id: job.conversation_id, status: 'manual_only', reason: 'no_agents_configured' });
            continue;
          }
          
          // Tem agentes mas nenhum disponível → retry
          await handleJobFailure(supabase, job, 'no_agents_available');
          failed++;
          results.push({ conversation_id: job.conversation_id, status: 'retry', reason: 'no_agents_available' });
          continue;
        }

        // 2c. Atomic assignment with lock - D3.3: NÃO mudar ai_mode automaticamente
        const { data: updateResult, error: updateError } = await supabase
          .from('conversations')
          .update({
            assigned_to: eligibleAgent.id,
            // ai_mode: Não muda - mantém 'waiting_human', agente decide via UI
            dispatch_status: 'assigned',
            last_dispatch_at: new Date().toISOString(),
          })
          .eq('id', job.conversation_id)
          .is('assigned_to', null) // Only if still unassigned (atomic lock)
          .select('id')
          .maybeSingle();

        if (updateError) {
          console.error(`[dispatch-conversations] Error assigning ${job.conversation_id}:`, updateError);
          await handleJobFailure(supabase, job, updateError.message);
          failed++;
          results.push({ conversation_id: job.conversation_id, status: 'failed', reason: updateError.message });
          continue;
        }

        if (!updateResult) {
          // Someone else assigned it first (race condition handled)
          console.log(`[dispatch-conversations] Conversation ${job.conversation_id} was assigned by another process`);
          await markJobComplete(supabase, job.id, 'assigned_by_other');
          continue;
        }

        // 2d. Success! Log and mark complete
        const executionTime = Date.now() - jobStartTime;
        
        await supabase.from('conversation_assignment_logs').insert({
          conversation_id: job.conversation_id,
          department_id: departmentId,
          assigned_to: eligibleAgent.id,
          algorithm: 'round_robin_least_loaded',
          reason: 'auto_dispatch',
          candidates_count: 1,
          execution_time_ms: executionTime,
          metadata: {
            job_id: job.id,
            attempts: job.attempts + 1,
            agent_active_chats: eligibleAgent.active_chats,
            agent_max_chats: eligibleAgent.max_chats,
          }
        });

        await markJobComplete(supabase, job.id, 'assigned');
        assigned++;
        results.push({ 
          conversation_id: job.conversation_id, 
          status: 'assigned', 
          agent: eligibleAgent.full_name 
        });

        console.log(`[dispatch-conversations] ✅ Assigned ${job.conversation_id} to ${eligibleAgent.full_name} (${executionTime}ms)`);

      } catch (jobError) {
        console.error(`[dispatch-conversations] Error processing job ${job.id}:`, jobError);
        await handleJobFailure(supabase, job, String(jobError));
        failed++;
      }
    }

    // 3. Check for escalations (jobs that exceeded max attempts)
    await processEscalations(supabase);

    const totalDuration = Date.now() - startTime;
    console.log(`[dispatch-conversations] Cycle complete: ${assigned} assigned, ${failed} failed (${totalDuration}ms)`);

    return new Response(JSON.stringify({
      processed: pendingJobs.length,
      assigned,
      failed,
      results,
      duration_ms: totalDuration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[dispatch-conversations] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: Date.now() - startTime,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Find the best eligible agent using Round-Robin Least-Loaded algorithm
 */
// deno-lint-ignore no-explicit-any
async function findEligibleAgent(
  supabase: any,
  departmentId: string
): Promise<EligibleAgent | null> {
  
  // Get eligible roles (same as useTransferConversation)
  const eligibleRoles = [
    'support_agent', 'sales_rep', 'cs_manager', 
    'support_manager', 'manager', 'general_manager', 'admin'
  ];

  // 1. Get users with eligible roles
  const { data: eligibleUserRoles, error: rolesError } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', eligibleRoles);

  if (rolesError || !eligibleUserRoles?.length) {
    console.log('[findEligibleAgent] No eligible roles found');
    return null;
  }

  const eligibleUserIds = eligibleUserRoles.map((r: { user_id: string }) => r.user_id);

  // 2. Get department info to check for parent
  const { data: department } = await supabase
    .from('departments')
    .select('id, parent_id')
    .eq('id', departmentId)
    .single();

  // Include parent department if exists
  const deptIds = [departmentId];
  if (department?.parent_id) {
    deptIds.push(department.parent_id);
  }

  // 3. Get online profiles in department with capacity info
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, last_status_change')
    .eq('availability_status', 'online')
    .eq('is_blocked', false)
    .in('department', deptIds)
    .in('id', eligibleUserIds);

  if (profilesError || !profiles?.length) {
    console.log('[findEligibleAgent] No online profiles in department');
    return null;
  }

  // 4. Get team settings for max chats
  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('user_id, team:teams(id, team_settings(max_concurrent_chats))')
    .in('user_id', profiles.map((p: { id: string }) => p.id));

  // Build capacity map
  const capacityMap = new Map<string, number>();
  // deno-lint-ignore no-explicit-any
  for (const tm of (teamMembers || []) as any[]) {
    const maxChats = tm.team?.team_settings?.max_concurrent_chats ?? 10;
    capacityMap.set(tm.user_id, maxChats);
  }

  // 5. Count active conversations per agent (D3.2: carga humana completa)
  // Inclui waiting_human porque se está atribuída, é carga do agente
  const { data: activeConvs } = await supabase
    .from('conversations')
    .select('assigned_to')
    .in('ai_mode', ['waiting_human', 'copilot', 'disabled']) // Todas as cargas humanas
    .eq('status', 'open') // Só 'open' é válido no enum (não existe 'pending')
    .in('assigned_to', profiles.map((p: { id: string }) => p.id));

  const activeChatsMap = new Map<string, number>();
  // deno-lint-ignore no-explicit-any
  for (const conv of (activeConvs || []) as any[]) {
    if (conv.assigned_to) {
      activeChatsMap.set(conv.assigned_to, (activeChatsMap.get(conv.assigned_to) || 0) + 1);
    }
  }

  // 6. Find agents with capacity
  // deno-lint-ignore no-explicit-any
  const agentsWithCapacity: EligibleAgent[] = profiles
    .map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      max_chats: capacityMap.get(p.id) ?? 10,
      active_chats: activeChatsMap.get(p.id) ?? 0,
      last_status_change: p.last_status_change,
    }))
    .filter((a: EligibleAgent) => a.active_chats < a.max_chats);

  if (agentsWithCapacity.length === 0) {
    console.log('[findEligibleAgent] All agents at capacity');
    return null;
  }

  // 7. Sort by least-loaded, then by last_status_change (round-robin)
  agentsWithCapacity.sort((a, b) => {
    if (a.active_chats !== b.active_chats) {
      return a.active_chats - b.active_chats; // Least loaded first
    }
    // If same load, prefer the one online longer (round-robin effect)
    return new Date(a.last_status_change).getTime() - new Date(b.last_status_change).getTime();
  });

  return agentsWithCapacity[0];
}

/**
 * D4.1: Check if department has ANY agents configured (regardless of online status)
 */
// deno-lint-ignore no-explicit-any
async function checkDepartmentHasAgents(
  supabase: any,
  departmentId: string
): Promise<boolean> {
  // Get eligible roles (same as findEligibleAgent)
  const eligibleRoles = [
    'support_agent', 'sales_rep', 'cs_manager', 
    'support_manager', 'manager', 'general_manager', 'admin'
  ];

  // Get users with eligible roles
  const { data: eligibleUserRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', eligibleRoles);

  if (!eligibleUserRoles?.length) {
    return false;
  }

  const eligibleUserIds = eligibleUserRoles.map((r: { user_id: string }) => r.user_id);

  // Check for parent department
  const { data: department } = await supabase
    .from('departments')
    .select('id, parent_id')
    .eq('id', departmentId)
    .single();

  const deptIds = [departmentId];
  if (department?.parent_id) {
    deptIds.push(department.parent_id);
  }

  // Count profiles in department with eligible roles (any status)
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .in('department', deptIds)
    .in('id', eligibleUserIds);

  if (error) {
    console.error('[checkDepartmentHasAgents] Error:', error);
    return false;
  }

  return (count ?? 0) > 0;
}

/**
 * Mark job as complete with reason
 */
// deno-lint-ignore no-explicit-any
async function markJobComplete(
  supabase: any,
  jobId: string,
  reason: string
) {
  await supabase
    .from('conversation_dispatch_jobs')
    .update({ 
      status: 'completed', 
      last_error: reason,
      updated_at: new Date().toISOString() 
    })
    .eq('id', jobId);
}

/**
 * Handle job failure with retry scheduling
 */
// deno-lint-ignore no-explicit-any
async function handleJobFailure(
  supabase: any,
  job: DispatchJob,
  errorMessage: string
) {
  const newAttempts = job.attempts + 1;
  
  // Calculate next retry with exponential backoff
  let nextAttemptDelay: number;
  if (newAttempts === 1) nextAttemptDelay = 30; // 30 seconds
  else if (newAttempts === 2) nextAttemptDelay = 60; // 1 minute
  else if (newAttempts === 3) nextAttemptDelay = 120; // 2 minutes
  else nextAttemptDelay = 300; // 5 minutes

  const nextAttemptAt = new Date(Date.now() + nextAttemptDelay * 1000).toISOString();
  
  // Check if should escalate
  const newStatus = newAttempts >= job.max_attempts ? 'escalated' : 'pending';

  await supabase
    .from('conversation_dispatch_jobs')
    .update({
      attempts: newAttempts,
      next_attempt_at: nextAttemptAt,
      last_error: errorMessage,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);

  // Update conversation dispatch status
  await supabase
    .from('conversations')
    .update({
      dispatch_attempts: newAttempts,
      last_dispatch_at: new Date().toISOString(),
      dispatch_status: newStatus === 'escalated' ? 'escalated' : 'pending',
    })
    .eq('id', job.conversation_id);
}

/**
 * Process escalations and create admin alerts
 */
// deno-lint-ignore no-explicit-any
async function processEscalations(supabase: any) {
  // Find newly escalated jobs
  const { data: escalatedJobs } = await supabase
    .from('conversation_dispatch_jobs')
    .select(`
      id,
      conversation_id,
      department_id,
      attempts,
      created_at,
      department:departments(name)
    `)
    .eq('status', 'escalated');

  if (!escalatedJobs?.length) return;

  // deno-lint-ignore no-explicit-any
  for (const job of escalatedJobs as any[]) {
    // Check if alert already exists (within 30 minutes)
    const { data: existingAlert } = await supabase
      .from('admin_alerts')
      .select('id')
      .eq('type', 'conversation_stuck')
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .filter('metadata->>conversation_id', 'eq', job.conversation_id)
      .maybeSingle();

    if (existingAlert) continue;

    // Create admin alert
    await supabase.from('admin_alerts').insert({
      type: 'conversation_stuck',
      title: 'Conversa não atribuída há mais de 5 minutos',
      message: `Departamento: ${job.department?.name || 'Desconhecido'}. ${job.attempts} tentativas de atribuição falharam.`,
      metadata: {
        conversation_id: job.conversation_id,
        department_id: job.department_id,
        attempts: job.attempts,
        created_at: job.created_at,
      },
    });

    console.log(`[dispatch-conversations] 🚨 Created escalation alert for ${job.conversation_id}`);
  }
}
