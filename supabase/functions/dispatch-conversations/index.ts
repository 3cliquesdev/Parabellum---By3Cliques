import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getBusinessHoursInfo } from "../_shared/business-hours.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==================== BATCH PROCESSING CONFIG ====================
const BATCH_SIZE = 5;                    // Process 5 jobs in parallel
const DELAY_BETWEEN_BATCHES_MS = 100;    // 100ms delay between batches
// ==================================================================

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

interface JobResult {
  conversation_id: string;
  status: string;
  agent?: string;
  reason?: string;
}

/**
 * Enterprise Conversation Dispatcher
 * 
 * Processes pending dispatch jobs and assigns conversations to eligible agents
 * using a Round-Robin Least-Loaded algorithm with atomic locking.
 * 
 * 🚀 BATCH PROCESSING: Processes up to BATCH_SIZE jobs in parallel for 5x faster throughput
 * ✅ AUTO-REQUEUE: Requeues escalated jobs when agents come online
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

    console.log('[dispatch-conversations] Starting dispatch cycle (BATCH MODE)...');

    // ==================== FIX 2: Reconcile orphan waiting_human conversations ====================
    try {
      const { data: orphans } = await supabase
        .from('conversations')
        .select('id, department')
        .eq('ai_mode', 'waiting_human')
        .eq('status', 'open')
        .is('assigned_to', null);

      let reconciled = 0;
      for (const orphan of orphans ?? []) {
        const { data: job } = await supabase
          .from('conversation_dispatch_jobs')
          .select('id')
          .eq('conversation_id', orphan.id)
          .in('status', ['pending', 'escalated'])
          .maybeSingle();

        if (!job && orphan.department) {
          await supabase.from('conversation_dispatch_jobs').insert({
            conversation_id: orphan.id,
            department_id: orphan.department,
            priority: 1,
            status: 'pending',
            next_attempt_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          reconciled++;
          console.log(`[RECONCILE] Created missing dispatch job for orphan conversation ${orphan.id.substring(0, 8)}`);
        }
      }
      if (reconciled > 0) {
        console.log(`[dispatch-conversations] 🔒 Reconciled ${reconciled} orphan conversations`);
      }
    } catch (reconcileErr) {
      console.error('[dispatch-conversations] ⚠️ Reconciliation error (non-blocking):', reconcileErr);
    }

    // ==================== FIX 3: Queue hygiene — remove dead entries ====================
    try {
      const { data: closedConvs } = await supabase
        .from('conversation_queue')
        .select('id, conversation_id, conversations!inner(status)')
        .in('conversations.status', ['closed', 'resolved', 'finished']);

      if (closedConvs && closedConvs.length > 0) {
        const ids = closedConvs.map((e: any) => e.id);
        await supabase.from('conversation_queue').delete().in('id', ids);
        console.log(`[QUEUE HYGIENE] Removed ${ids.length} stale queue entries for closed conversations`);
      }
    } catch (hygieneErr) {
      console.error('[dispatch-conversations] ⚠️ Queue hygiene error (non-blocking):', hygieneErr);
    }

    // ==================== NEW: Parse body for agent context ====================
    let agentDepartmentId: string | undefined;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        agentDepartmentId = body.department_id;
        if (agentDepartmentId) {
          console.log(`[dispatch-conversations] 🟢 Agent came online in dept: ${agentDepartmentId}`);
        }
      } catch {
        // No body or invalid JSON, that's fine
      }
    }

    // ==================== NEW: Requeue escalated jobs ====================
    const requeueResult = await requeueEscalatedJobs(supabase, agentDepartmentId);
    if (requeueResult.requeued > 0) {
      console.log(`[dispatch-conversations] ♻️ Requeued ${requeueResult.requeued} escalated jobs`);
    }
    // ======================================================================

    // ==================== NEW: Requeue stuck jobs ====================
    const stuckResult = await requeueStuckJobs(supabase);
    if (stuckResult.requeued > 0) {
      console.log(`[dispatch-conversations] 🔄 Requeued ${stuckResult.requeued} stuck jobs`);
    }
    // ======================================================================

    // 1. Fetch pending jobs with SLA priority (JOIN conversations for wait time)
    const { data: pendingJobs, error: jobsError } = await supabase
      .from('conversation_dispatch_jobs')
      .select('*, conversation:conversations(last_message_at)')
      .eq('status', 'pending')
      .lte('next_attempt_at', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(50);

    // Re-sort by SLA priority: older conversations first within same priority
    if (pendingJobs?.length) {
      pendingJobs.sort((a: any, b: any) => {
        // First by priority DESC
        if (a.priority !== b.priority) return b.priority - a.priority;
        // Then by conversation wait time DESC (older = higher priority)
        const aWait = a.conversation?.last_message_at ? new Date(a.conversation.last_message_at).getTime() : Date.now();
        const bWait = b.conversation?.last_message_at ? new Date(b.conversation.last_message_at).getTime() : Date.now();
        return aWait - bWait; // Older first
      });
    }

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
        requeued: requeueResult.requeued,
        duration_ms: Date.now() - startTime 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[dispatch-conversations] Found ${pendingJobs.length} pending jobs - processing in batches of ${BATCH_SIZE}`);

    let assigned = 0;
    let failed = 0;
    const results: JobResult[] = [];

    // 2. Process jobs in parallel batches
    const totalBatches = Math.ceil(pendingJobs.length / BATCH_SIZE);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * BATCH_SIZE;
      const batch = (pendingJobs as DispatchJob[]).slice(batchStart, batchStart + BATCH_SIZE);
      
      console.log(`[dispatch-conversations] 📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} jobs)`);
      
      // Process entire batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map((job) => processJob(supabase, job))
      );
      
      // Aggregate results from batch
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const jobResult = result.value;
          if (jobResult.status === 'assigned') {
            assigned++;
          } else if (jobResult.status === 'failed' || jobResult.status === 'retry') {
            failed++;
          }
          results.push(jobResult);
        } else {
          // Promise rejected - unexpected error
          failed++;
          console.error('[dispatch-conversations] Batch job error:', result.reason);
        }
      }
      
      // Small delay between batches to avoid overloading the database
      if (batchIndex + 1 < totalBatches) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    // 3. Check for escalations (jobs that exceeded max attempts)
    await processEscalations(supabase);

    const totalDuration = Date.now() - startTime;
    console.log(`[dispatch-conversations] ✅ Cycle complete: ${assigned} assigned, ${failed} failed, ${requeueResult.requeued} requeued in ${totalBatches} batches (${totalDuration}ms)`);

    return new Response(JSON.stringify({
      processed: pendingJobs.length,
      assigned,
      failed,
      requeued: requeueResult.requeued,
      batches: totalBatches,
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
 * ==================== NEW FUNCTION ====================
 * Requeue escalated jobs when agents become available
 * 
 * This solves the bug where conversations get stuck in "escalated" status
 * even after agents come back online.
 */
// deno-lint-ignore no-explicit-any
async function requeueEscalatedJobs(
  supabase: any, 
  specificDepartmentId?: string
): Promise<{ requeued: number; departments: string[] }> {
  const requeuedDepartments: string[] = [];
  let totalRequeued = 0;

  try {
    // Determine which departments to check
    let targetDepartmentIds: string[] = [];

    if (specificDepartmentId) {
      // Agent just came online in specific department
      targetDepartmentIds = [specificDepartmentId];
    } else {
      // General dispatch cycle - check all departments with escalated jobs
      const { data: escalatedDepts } = await supabase
        .from('conversation_dispatch_jobs')
        .select('department_id')
        .eq('status', 'escalated')
        .not('department_id', 'is', null);

      if (!escalatedDepts?.length) {
        console.log('[requeueEscalatedJobs] No escalated jobs found');
        return { requeued: 0, departments: [] };
      }

      // Get unique department IDs
      targetDepartmentIds = [...new Set(escalatedDepts.map((j: { department_id: string }) => j.department_id))] as string[];
    }

    console.log(`[requeueEscalatedJobs] Checking ${targetDepartmentIds.length} department(s) for requeue eligibility`);

    // Check each department
    for (const deptId of targetDepartmentIds) {
      // Verify there's at least one eligible agent with capacity
      const eligibleAgent = await findEligibleAgent(supabase, deptId);
      
      if (!eligibleAgent) {
        console.log(`[requeueEscalatedJobs] Dept ${deptId}: No eligible agents, skipping requeue`);
        continue;
      }

      console.log(`[requeueEscalatedJobs] Dept ${deptId}: Agent ${eligibleAgent.full_name} available, requeuing escalated jobs`);

      // Requeue escalated jobs for this department
      const { data: requeuedJobs, error: requeueError } = await supabase
        .from('conversation_dispatch_jobs')
        .update({ 
          status: 'pending', 
          attempts: 0,
          next_attempt_at: new Date().toISOString(),
          last_error: 'requeued_agent_online',
          updated_at: new Date().toISOString()
        })
        .eq('status', 'escalated')
        .eq('department_id', deptId)
        .select('conversation_id');

      if (requeueError) {
        console.error(`[requeueEscalatedJobs] Error requeuing jobs in dept ${deptId}:`, requeueError);
        continue;
      }

      if (requeuedJobs?.length) {
        // Update conversation dispatch_status
        const conversationIds = requeuedJobs.map((j: { conversation_id: string }) => j.conversation_id);
        
        await supabase
          .from('conversations')
          .update({ 
            dispatch_status: 'pending',
            dispatch_attempts: 0
          })
          .in('id', conversationIds);

        totalRequeued += requeuedJobs.length;
        requeuedDepartments.push(deptId);

        console.log(`[requeueEscalatedJobs] ✅ Requeued ${requeuedJobs.length} conversations in dept ${deptId}`);
      }
    }

    return { requeued: totalRequeued, departments: requeuedDepartments };

  } catch (error) {
    console.error('[requeueEscalatedJobs] Error:', error);
    return { requeued: 0, departments: [] };
  }
}

/**
 * Process a single dispatch job
 * Extracted to support parallel processing with Promise.allSettled
 */
// deno-lint-ignore no-explicit-any
async function processJob(supabase: any, job: DispatchJob): Promise<JobResult> {
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
      return { conversation_id: job.conversation_id, status: 'skipped', reason: 'lock_error' };
    }

    if (!lockedJob) {
      // Outro worker já pegou este job - pular
      console.log(`[dispatch-conversations] Job ${job.id} already picked by another worker`);
      return { conversation_id: job.conversation_id, status: 'skipped', reason: 'already_locked' };
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
      return { conversation_id: job.conversation_id, status: 'skipped', reason: 'not_found' };
    }

    // If already assigned, skip
    if (conversation.assigned_to) {
      console.log(`[dispatch-conversations] Conversation ${job.conversation_id} already assigned to ${conversation.assigned_to}`);
      await markJobComplete(supabase, job.id, 'already_assigned');
      return { conversation_id: job.conversation_id, status: 'skipped', reason: 'already_assigned' };
    }

    // If not in a mode that needs human dispatch, skip
    if (!['waiting_human', 'copilot'].includes(conversation.ai_mode)) {
      console.log(`[dispatch-conversations] Conversation ${job.conversation_id} in mode ${conversation.ai_mode}, not dispatching`);
      await markJobComplete(supabase, job.id, 'mode_not_dispatchable');
      return { conversation_id: job.conversation_id, status: 'skipped', reason: 'mode_not_dispatchable' };
    }

    // If status is not open, skip
    if (conversation.status !== 'open') {
      console.log(`[dispatch-conversations] Conversation ${job.conversation_id} not open (${conversation.status})`);
      await markJobComplete(supabase, job.id, 'not_open');
      return { conversation_id: job.conversation_id, status: 'skipped', reason: 'not_open' };
    }

    const departmentId = job.department_id || conversation.department;
    
    if (!departmentId) {
      console.log(`[dispatch-conversations] No department for conversation ${job.conversation_id}`);
      await handleJobFailure(supabase, job, 'no_department');
      return { conversation_id: job.conversation_id, status: 'failed', reason: 'no_department' };
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
        return { conversation_id: job.conversation_id, status: 'manual_only', reason: 'no_agents_configured' };
      }
      
      // Tem agentes mas nenhum disponível → retry
      await handleJobFailure(supabase, job, 'no_agents_available');
      return { conversation_id: job.conversation_id, status: 'retry', reason: 'no_agents_available' };
    }

    // 2c. Atomic assignment with lock - FIX: Mudar ai_mode para copilot na atribuição
    const { data: updateResult, error: updateError } = await supabase
      .from('conversations')
      .update({
        assigned_to: eligibleAgent.id,
        ai_mode: 'copilot', // ✅ FIX: Habilita composer imediatamente para o agente atribuído
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
      return { conversation_id: job.conversation_id, status: 'failed', reason: updateError.message };
    }

    if (!updateResult) {
      // Someone else assigned it first (race condition handled)
      console.log(`[dispatch-conversations] Conversation ${job.conversation_id} was assigned by another process`);
      await markJobComplete(supabase, job.id, 'assigned_by_other');
      return { conversation_id: job.conversation_id, status: 'skipped', reason: 'assigned_by_other' };
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
        batch_mode: true,
      }
    });

    await markJobComplete(supabase, job.id, 'assigned');

    console.log(`[dispatch-conversations] ✅ Assigned ${job.conversation_id} to ${eligibleAgent.full_name} (${executionTime}ms)`);

    return { 
      conversation_id: job.conversation_id, 
      status: 'assigned', 
      agent: eligibleAgent.full_name 
    };

  } catch (jobError) {
    console.error(`[dispatch-conversations] Error processing job ${job.id}:`, jobError);
    await handleJobFailure(supabase, job, String(jobError));
    return { conversation_id: job.conversation_id, status: 'failed', reason: String(jobError) };
  }
}

/**
 * Find the best eligible agent using Round-Robin Least-Loaded algorithm
 * with HIERARCHICAL FALLBACK: subdept → parent dept
 */
// deno-lint-ignore no-explicit-any
async function findEligibleAgent(
  supabase: any,
  departmentId: string,
  attemptedDepts: string[] = []
): Promise<EligibleAgent | null> {
  
  // Avoid infinite loops in recursive fallback
  if (attemptedDepts.includes(departmentId)) {
    console.log(`[findEligibleAgent] Already tried dept ${departmentId}, stopping recursion`);
    return null;
  }
  attemptedDepts.push(departmentId);
  
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

  console.log(`[findEligibleAgent] Searching in dept: ${departmentId} (attempt ${attemptedDepts.length})`);

  // 2. Get online profiles in department with capacity info (using agent_departments N:N)
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select(`
      id, 
      full_name, 
      last_status_change,
      agent_departments!inner(department_id)
    `)
    .eq('availability_status', 'online')
    .eq('is_blocked', false)
    .eq('agent_departments.department_id', departmentId)
    .in('id', eligibleUserIds);

  // If we found agents in this department, process them
  if (!profilesError && profiles?.length) {
    const agent = await processAgentCapacity(supabase, profiles, eligibleUserIds);
    if (agent) {
      console.log(`[findEligibleAgent] ✅ Found agent ${agent.full_name} in dept ${departmentId}`);
      return agent;
    }
    console.log(`[findEligibleAgent] All agents at capacity in dept ${departmentId}`);
  } else {
    console.log(`[findEligibleAgent] No online agents in dept ${departmentId}`);
  }

  // 3. STRICT MODE: No fallback to parent department
  // Conversations must wait in queue until an agent from the exact department is available
  console.log(`[findEligibleAgent] ℹ️ No agents available in dept ${departmentId}. Strict mode: no fallback to parent.`);
  return null;
}

/**
 * Process agent capacity and return the best agent (extracted for reuse)
 */
// deno-lint-ignore no-explicit-any
async function processAgentCapacity(
  supabase: any,
  profiles: any[],
  eligibleUserIds: string[]
): Promise<EligibleAgent | null> {
  
  // Get team settings for max chats
  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('user_id, team:teams(id, team_settings(max_concurrent_chats))')
    .in('user_id', profiles.map((p: { id: string }) => p.id));

  // Build capacity map
  const capacityMap = new Map<string, number>();
  // deno-lint-ignore no-explicit-any
  for (const tm of (teamMembers || []) as any[]) {
    // Enterprise: Respect team-configured capacity limits (fallback: 10)
    const configuredMax = tm.team?.team_settings?.max_concurrent_chats;
    const maxChats = configuredMax ?? 40;
    capacityMap.set(tm.user_id, maxChats);
  }

  // Count active conversations per agent (D3.2: carga humana completa)
  const { data: activeConvs } = await supabase
    .from('conversations')
    .select('assigned_to')
    .in('ai_mode', ['waiting_human', 'copilot', 'disabled'])
    .eq('status', 'open')
    .in('assigned_to', profiles.map((p: { id: string }) => p.id));

  const activeChatsMap = new Map<string, number>();
  // deno-lint-ignore no-explicit-any
  for (const conv of (activeConvs || []) as any[]) {
    if (conv.assigned_to) {
      activeChatsMap.set(conv.assigned_to, (activeChatsMap.get(conv.assigned_to) || 0) + 1);
    }
  }

  // Find agents with capacity
  // deno-lint-ignore no-explicit-any
  const agentsWithCapacity: EligibleAgent[] = profiles
    .map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      max_chats: capacityMap.get(p.id) ?? 40,
      active_chats: activeChatsMap.get(p.id) ?? 0,
      last_status_change: p.last_status_change,
    }))
    .filter((a: EligibleAgent) => a.active_chats < a.max_chats);

  if (agentsWithCapacity.length === 0) {
    return null;
  }

  // Sort by least-loaded, then by last_status_change (round-robin)
  agentsWithCapacity.sort((a, b) => {
    if (a.active_chats !== b.active_chats) {
      return a.active_chats - b.active_chats;
    }
    return new Date(a.last_status_change).getTime() - new Date(b.last_status_change).getTime();
  });

  return agentsWithCapacity[0];
}

/**
 * D4.1: Check if department has ANY agents configured (regardless of online status)
 * with HIERARCHICAL FALLBACK: subdept → parent dept
 */
// deno-lint-ignore no-explicit-any
async function checkDepartmentHasAgents(
  supabase: any,
  departmentId: string,
  attemptedDepts: string[] = []
): Promise<boolean> {
  
  // Avoid infinite loops in recursive fallback
  if (attemptedDepts.includes(departmentId)) {
    return false;
  }
  attemptedDepts.push(departmentId);
  
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

  // Count profiles in department with eligible roles (any status) - using agent_departments N:N
  const { count, error } = await supabase
    .from('profiles')
    .select('id, agent_departments!inner(department_id)', { count: 'exact', head: true })
    .eq('agent_departments.department_id', departmentId)
    .in('id', eligibleUserIds);

  if (error) {
    console.error('[checkDepartmentHasAgents] Error:', error);
    return false;
  }

  if ((count ?? 0) > 0) {
    console.log(`[checkDepartmentHasAgents] Found ${count} agents in dept ${departmentId}`);
    return true;
  }

  // STRICT MODE: No fallback to parent department
  console.log(`[checkDepartmentHasAgents] No agents in dept ${departmentId}. Strict mode: no fallback.`);
  return false;
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
  
  // Enterprise: Aggressive backoff for faster distribution
  let nextAttemptDelay: number;
  if (newAttempts === 1) nextAttemptDelay = 10; // 10 seconds
  else if (newAttempts === 2) nextAttemptDelay = 20; // 20 seconds
  else if (newAttempts === 3) nextAttemptDelay = 30; // 30 seconds
  else nextAttemptDelay = 60; // 1 minute max

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

  // 🆕 Correção 3: Notificação periódica ao cliente em espera longa
  if (newAttempts >= 3 && newStatus !== 'escalated') {
    try {
      // Rate-limit: verificar se já enviamos nos últimos 5 minutos
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentMsg } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', job.conversation_id)
        .eq('is_bot_message', true)
        .ilike('content', '%procurando um especialista%')
        .gte('created_at', fiveMinAgo)
        .limit(1)
        .maybeSingle();

      if (!recentMsg) {
        const { data: convData } = await supabase
          .from('conversations')
          .select('channel')
          .eq('id', job.conversation_id)
          .maybeSingle();

        await supabase.from('messages').insert({
          conversation_id: job.conversation_id,
          content: '⏳ Ainda estamos procurando um especialista disponível. Você será atendido em breve!',
          sender_type: 'user',
          is_ai_generated: true,
          is_bot_message: true,
          channel: convData?.channel || 'web_chat',
        });
        console.log(`[dispatch-conversations] 📢 Notificação de espera enviada para ${job.conversation_id.substring(0, 8)}`);
      }
    } catch (notifyErr) {
      console.error('[dispatch-conversations] ⚠️ Erro ao enviar notificação de espera:', notifyErr);
    }
  }
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

/**
 * ==================== NEW: Requeue stuck jobs ====================
 * Finds jobs that are "pending" but haven't been processed (next_attempt_at passed >3 min ago)
 * and resets them to be picked up immediately.
 */
// deno-lint-ignore no-explicit-any
async function requeueStuckJobs(supabase: any): Promise<{ requeued: number }> {
  try {
    const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    
    const { data: stuckJobs, error } = await supabase
      .from('conversation_dispatch_jobs')
      .update({
        next_attempt_at: new Date().toISOString(),
        attempts: 0,
        last_error: 'requeued_stuck_job',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'pending')
      .lt('next_attempt_at', threeMinAgo)
      .gt('attempts', 0)
      .select('id');

    if (error) {
      console.error('[requeueStuckJobs] Error:', error);
      return { requeued: 0 };
    }

    return { requeued: stuckJobs?.length || 0 };
  } catch (error) {
    console.error('[requeueStuckJobs] Error:', error);
    return { requeued: 0 };
  }
}
