import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueueItem {
  id: string;
  execution_id: string;
  node_id: string;
  node_type: string;
  node_data: any;
  retry_count: number;
  max_retries: number;
}

interface PlaybookExecution {
  id: string;
  playbook_id: string;
  contact_id: string;
  status: string;
  current_node_id: string;
  nodes_executed: any[];
  errors: any[];
  execution_context?: {
    is_test_mode?: boolean;
    speed_multiplier?: number;
    test_recipient_email?: string;
    test_recipient_name?: string;
    test_run_id?: string;
    test_run_started_by?: string;
    started_at?: string;
  };
}

// ============ HELPER: Update playbook_test_runs status when execution finishes ============
async function updateTestRunStatus(supabase: any, execution: PlaybookExecution, status: 'done' | 'failed', errorMessage?: string) {
  if (execution.execution_context?.is_test_mode) {
    const updateData: any = { 
      status: status,
      updated_at: new Date().toISOString() 
    };
    
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }
    
    const { error } = await supabase
      .from('playbook_test_runs')
      .update(updateData)
      .eq('execution_id', execution.id);
    
    if (error) {
      console.error(`[updateTestRunStatus] Failed to update test_run for execution ${execution.id}:`, error);
    } else {
      console.log(`[updateTestRunStatus] 🧪 Test run status updated to '${status}' for execution ${execution.id}`);
    }
  }
}

// ============ HELPER: Update playbook_test_runs progress after each node ============
async function updateTestRunProgress(
  supabase: any, 
  execution: PlaybookExecution, 
  item: QueueItem
) {
  if (!execution.execution_context?.is_test_mode) return;
  
  try {
    // Fetch current state from DB (avoids drift/race conditions)
    const { data: currentRun, error: fetchError } = await supabase
      .from('playbook_test_runs')
      .select('executed_nodes, total_nodes')
      .eq('execution_id', execution.id)
      .single();
    
    if (fetchError || !currentRun) {
      console.error(`[updateTestRunProgress] Failed to fetch current run:`, fetchError);
      return;
    }
    
    // Calculate next executed count (clamped to total_nodes)
    const nextExecuted = Math.min(
      currentRun.total_nodes ?? 0,
      (currentRun.executed_nodes ?? 0) + 1
    );
    
    // Find next scheduled item for progress display
    const { data: nextScheduledItems } = await supabase
      .from('playbook_execution_queue')
      .select('scheduled_for')
      .eq('execution_id', execution.id)
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true })
      .limit(1);
    
    const updateData = {
      executed_nodes: nextExecuted,
      current_node_id: item.node_id,
      last_node_type: item.node_type,
      last_event_at: new Date().toISOString(),
      next_scheduled_for: nextScheduledItems?.[0]?.scheduled_for || null,
      updated_at: new Date().toISOString(),
    };
    
    const { error: updateError } = await supabase
      .from('playbook_test_runs')
      .update(updateData)
      .eq('execution_id', execution.id);
    
    if (updateError) {
      console.error(`[updateTestRunProgress] Failed to update progress:`, updateError);
    } else {
      console.log(`[updateTestRunProgress] 🧪 Progress: ${nextExecuted}/${currentRun.total_nodes} (node: ${item.node_type})`);
    }
  } catch (err) {
    console.error(`[updateTestRunProgress] Unexpected error:`, err);
  }
}
function getEmailTarget(
  execution: PlaybookExecution, 
  item: QueueItem, 
  contact: any, 
  fallbackName: string
): { isTestMode: boolean; speedMultiplier: number; to: string; to_name: string } {
  const isTestMode = execution.execution_context?.is_test_mode === true || item.node_data?._test_mode === true;
  const speedMultiplier = item.node_data?._speed_multiplier ?? execution.execution_context?.speed_multiplier ?? 1;
  
  const to = isTestMode 
    ? (execution.execution_context?.test_recipient_email || contact.email) 
    : contact.email;
  const to_name = isTestMode 
    ? (execution.execution_context?.test_recipient_name || fallbackName) 
    : fallbackName;
  
  return { isTestMode, speedMultiplier, to, to_name };
}

interface PlaybookFlow {
  nodes: Array<{ id: string; type: string; data: any }>;
  edges: Array<{ source: string; target: string }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting playbook queue processing...');

    // Lock atômico via RPC com FOR UPDATE SKIP LOCKED (evita race condition)
    const { data: queueItems, error: queueError } = await supabaseAdmin.rpc(
      'claim_playbook_queue_items',
      { batch_size: 10 }
    );

    if (queueError) {
      console.error('Failed to claim queue items:', queueError);
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No pending queue items found');
      return new Response(
        JSON.stringify({ message: 'No items to process', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Claimed ${queueItems.length} queue items for processing (atomic lock)`);

    console.log(`Found ${queueItems.length} queue items to process`);

    let processedCount = 0;
    let failedCount = 0;

    for (const item of queueItems as QueueItem[]) {
      try {
        console.log(`Processing queue item: id=${item.id}, type=${item.node_type}, execution=${item.execution_id}`);

        // O RPC claim_playbook_queue_items já marcou como 'processing' atomicamente
        // Não precisa de update separado aqui

        // Fetch execution record
        const { data: execution, error: execError } = await supabaseAdmin
          .from('playbook_executions')
          .select('*')
          .eq('id', item.execution_id)
          .single();

        if (execError || !execution) {
          throw new Error(`Execution not found: ${item.execution_id}`);
        }

        // Fetch contact
        const { data: contact, error: contactError } = await supabaseAdmin
          .from('contacts')
          .select('*')
          .eq('id', (execution as PlaybookExecution).contact_id)
          .single();

        if (contactError || !contact) {
          throw new Error(`Contact not found: ${(execution as PlaybookExecution).contact_id}`);
        }

        // Fetch playbook
        const { data: playbook, error: playbookError } = await supabaseAdmin
          .from('onboarding_playbooks')
          .select('*')
          .eq('id', (execution as PlaybookExecution).playbook_id)
          .single();

        if (playbookError || !playbook) {
          throw new Error(`Playbook not found: ${(execution as PlaybookExecution).playbook_id}`);
        }

        // ✅ Verificar se playbook está ativo antes de processar
        if (!playbook.is_active) {
          console.log(`⏸️ Playbook pausado (${playbook.name}), cancelando item da fila: ${item.id}`);
          
          await supabaseAdmin
            .from('playbook_execution_queue')
            .update({ 
              status: 'cancelled',
              last_error: 'Playbook desativado'
            })
            .eq('id', item.id);
          
          continue; // Pular para o próximo item
        }

        const flow = playbook.flow_definition as PlaybookFlow;

        // Execute node action based on type
        let actionResult: any = { success: true };

        switch (item.node_type) {
          case 'email':
            actionResult = await executeEmailNode(supabaseAdmin, item, contact, execution as PlaybookExecution);
            break;
          case 'delay':
            actionResult = await executeDelayNode(supabaseAdmin, item, flow, execution as PlaybookExecution);
            break;
          case 'task':
            actionResult = await executeTaskNode(supabaseAdmin, item, contact);
            break;
          case 'call':
            actionResult = await executeCallNode(supabaseAdmin, item, contact);
            break;
          case 'form':
            actionResult = await executeFormNode(supabaseAdmin, item, contact, execution as PlaybookExecution);
            break;
          case 'condition':
            actionResult = await executeConditionNode(supabaseAdmin, item, flow, execution as PlaybookExecution);
            break;
          case 'switch':
            actionResult = await executeSwitchNode(supabaseAdmin, item, flow, execution as PlaybookExecution);
            break;
          default:
            console.warn(`Unknown node type: ${item.node_type}`);
            actionResult = { success: true, message: 'Skipped unknown node type' };
        }

        if (!actionResult.success) {
          throw new Error(actionResult.error || 'Action execution failed');
        }

        // Mark node as executed
        const nodesExecuted = [...((execution as PlaybookExecution).nodes_executed || [])];
        nodesExecuted.push({
          node_id: item.node_id,
          node_type: item.node_type,
          executed_at: new Date().toISOString(),
          result: actionResult,
        });

        await supabaseAdmin
          .from('playbook_executions')
          .update({ 
            nodes_executed: nodesExecuted,
            current_node_id: item.node_id,
          })
          .eq('id', item.execution_id);

        // Mark queue item as completed
        await supabaseAdmin
          .from('playbook_execution_queue')
          .update({ 
            status: 'completed',
            executed_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        // 🧪 UPDATE TEST RUN PROGRESS (if in test mode)
        await updateTestRunProgress(supabaseAdmin, execution as PlaybookExecution, item);

        // Queue next node if not a delay, form, condition, or switch (they queue internally)
        if (item.node_type !== 'delay' && item.node_type !== 'form' && item.node_type !== 'condition' && item.node_type !== 'switch') {
          await queueNextNode(supabaseAdmin, item, flow, execution as PlaybookExecution);
        }

        processedCount++;
        console.log(`Successfully processed queue item: ${item.id}`);

      } catch (error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to process queue item ${item.id}:`, errorMessage);

        // Implement retry logic with exponential backoff
        const newRetryCount = item.retry_count + 1;

        if (newRetryCount <= item.max_retries) {
          // Calculate next retry time with exponential backoff
          const backoffMinutes = newRetryCount === 1 ? 5 : newRetryCount === 2 ? 60 : 360;
          const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000);

          console.log(`Scheduling retry ${newRetryCount}/${item.max_retries} for ${nextRetry.toISOString()}`);

          await supabaseAdmin
            .from('playbook_execution_queue')
            .update({
              status: 'pending',
              retry_count: newRetryCount,
              last_error: errorMessage,
              next_retry_at: nextRetry.toISOString(),
              scheduled_for: nextRetry.toISOString(),
            })
            .eq('id', item.id);
        } else {
          // Max retries exceeded
          console.error(`Max retries exceeded for queue item ${item.id}`);

          await supabaseAdmin
            .from('playbook_execution_queue')
            .update({
              status: 'failed',
              last_error: errorMessage,
            })
            .eq('id', item.id);

          // Update execution with error
          const { data: failedExecution } = await supabaseAdmin
            .from('playbook_executions')
            .select('errors, metadata')
            .eq('id', item.execution_id)
            .single();

          const errors = [...(failedExecution?.errors || [])];
          errors.push({
            node_id: item.node_id,
            node_type: item.node_type,
            error: errorMessage,
            failed_at: new Date().toISOString(),
          });

          await supabaseAdmin
            .from('playbook_executions')
            .update({ 
              status: 'failed',
              errors,
            })
            .eq('id', item.execution_id);
          
          // 🧪 Update test_run status if test mode (with error message)
          if (failedExecution?.execution_context?.is_test_mode) {
            await supabaseAdmin
              .from('playbook_test_runs')
              .update({ 
                status: 'failed',
                error_message: errorMessage,
                updated_at: new Date().toISOString() 
              })
              .eq('execution_id', item.execution_id);
            
            console.log(`[test-mode] 🧪 Test run marked as failed for execution ${item.execution_id}: ${errorMessage}`);
          }
        }
      }
    }

    console.log(`Queue processing complete: processed=${processedCount}, failed=${failedCount}`);

    return new Response(
      JSON.stringify({ 
        message: 'Queue processing complete',
        processed: processedCount,
        failed: failedCount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in process-playbook-queue:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function executeEmailNode(supabase: any, item: QueueItem, contact: any, execution: PlaybookExecution) {
  console.log(`Executing email node: ${item.node_id}`);
  
  const emailData = item.node_data || {};
  let htmlContent = '';
  let subject = emailData.subject || 'Mensagem da equipe';
  
  // 1. Se tem template_id, buscar o template do banco
  if (emailData.template_id) {
    console.log(`Fetching email template: ${emailData.template_id}`);
    
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('html_body, subject, name')
      .eq('id', emailData.template_id)
      .single();
    
    if (templateError || !template) {
      console.error('Template not found:', templateError);
      return { success: false, error: `Template não encontrado: ${emailData.template_id}` };
    }
    
    console.log(`Template loaded: ${template.name}`);
    
    // Usar subject do template se não tiver no node
    if (!emailData.subject && template.subject) {
      subject = template.subject;
    }
    
    // 2. Substituir variáveis no template
    const today = new Date().toLocaleDateString('pt-BR');
    htmlContent = (template.html_body || '')
      // Variáveis em inglês (backward compatibility)
      .replace(/\{\{first_name\}\}/gi, contact.first_name || 'Cliente')
      .replace(/\{\{last_name\}\}/gi, contact.last_name || '')
      .replace(/\{\{phone\}\}/gi, contact.phone || '')
      .replace(/\{\{document\}\}/gi, contact.document || '')
      .replace(/\{\{company\}\}/gi, contact.company || '')
      // Variáveis em português (alinhadas com EmailBuilderV2)
      .replace(/\{\{nome\}\}/gi, contact.first_name || 'Cliente')
      .replace(/\{\{primeiro_nome\}\}/gi, contact.first_name || 'Cliente')
      .replace(/\{\{sobrenome\}\}/gi, contact.last_name || '')
      .replace(/\{\{email\}\}/gi, contact.email || '')
      .replace(/\{\{telefone\}\}/gi, contact.phone || '')
      .replace(/\{\{empresa\}\}/gi, contact.company || '')
      .replace(/\{\{data\}\}/gi, today);
    
    // Também substituir variáveis no subject
    subject = subject
      .replace(/\{\{primeiro_nome\}\}/gi, contact.first_name || 'Cliente')
      .replace(/\{\{nome\}\}/gi, contact.first_name || 'Cliente')
      .replace(/\{\{email\}\}/gi, contact.email || '');
    
  } else {
    // Fallback para body ou message do node
    htmlContent = emailData.body || emailData.message || '<p>Mensagem do seu playbook</p>';
  }
  
  // Validar que temos email do contato (for non-test mode)
  if (!contact.email) {
    console.error('Contact has no email address');
    return { success: false, error: 'Contato sem email cadastrado' };
  }
  
  const fallbackName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Cliente';
  
  // 🧪 Test mode: override destinatário using helper
  const { isTestMode, speedMultiplier, to, to_name } = getEmailTarget(execution, item, contact, fallbackName);
  
  // 🧪 Test mode: prefix subject (avoid duplicating [TESTE])
  const finalSubject = isTestMode
    ? (subject.startsWith('[TESTE]') ? subject : `[TESTE] ${subject}`)
    : subject;
  
  // 🧪 Test mode: add visual banner
  const testBanner = isTestMode
    ? `<div style="padding:12px 16px;background:#fef3c7;border:2px dashed #d97706;margin-bottom:16px;font-size:13px;color:#92400e;border-radius:8px;">
        <strong>🧪 EMAIL DE TESTE DO PLAYBOOK</strong><br/>
        <span style="font-size:12px;">Destinatário original: ${contact.email}</span><br/>
        <span style="font-size:12px;">Speed multiplier: ${speedMultiplier}x</span>
      </div>`
    : '';
  
  const finalHtml = isTestMode ? `${testBanner}${htmlContent}` : htmlContent;
  
  console.log(`${isTestMode ? '🧪 TEST MODE: ' : ''}Sending email to: ${to} (${to_name}), subject: ${finalSubject}`);
  
  // 3. Chamar send-email com todos os campos obrigatórios + correlação de nó
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: {
      to: to,
      to_name: to_name,
      subject: finalSubject,
      html: finalHtml,
      customer_id: contact.id,
      playbook_execution_id: execution.id,
      playbook_node_id: item.node_id,              // Correlação do nó que enviou
      template_id: emailData.template_id || null,  // Template usado
    },
  });

  if (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message };
  }

  console.log('Email sent successfully');
  return { success: true, data };
}

async function executeDelayNode(supabase: any, item: QueueItem, flow: PlaybookFlow, execution: PlaybookExecution) {
  console.log(`Executing delay node: ${item.node_id}`);
  
  // Import shared delay utilities
  const { convertDelayToSeconds, normalizeDelayData } = await import('../_shared/delay.ts');
  
  // Normalize delay data with backward compatibility
  const normalized = normalizeDelayData(item.node_data);
  let seconds = convertDelayToSeconds(normalized.delay_type, normalized.delay_value);

  // 🧪 Test Mode: Accelerate delays
  const speedMultiplier = item.node_data?._speed_multiplier || 1;
  const isTestMode = item.node_data?._test_mode === true;

  if (isTestMode && speedMultiplier > 1) {
    const originalSeconds = seconds;
    seconds = Math.max(5, Math.floor(seconds / speedMultiplier)); // Minimum 5 seconds
    console.log(`[executeDelayNode] 🧪 TEST MODE: Delay accelerated from ${originalSeconds}s to ${seconds}s (${speedMultiplier}x)`);
  }

  const nextExecutionTime = new Date(Date.now() + seconds * 1000);

  console.log(`Delay: ${normalized.delay_value} ${normalized.delay_type} (${seconds}s), next execution: ${nextExecutionTime.toISOString()}`);

  // Queue next node with delay
  const nextNodeId = findNextNode(item.node_id, flow);
  
  if (nextNodeId) {
    const nextNode = flow.nodes.find(n => n.id === nextNodeId);
    if (nextNode) {
      await supabase
        .from('playbook_execution_queue')
        .insert({
          execution_id: execution.id,
          node_id: nextNode.id,
          node_type: nextNode.type,
          node_data: {
            ...nextNode.data,
            _test_mode: item.node_data?._test_mode || false,
            _speed_multiplier: item.node_data?._speed_multiplier || 1,
          },
          scheduled_for: nextExecutionTime.toISOString(),
          status: 'pending',
          retry_count: 0,
          max_retries: 3,
        });
      
      console.log(`Next node queued with delay: ${nextNode.id} at ${nextExecutionTime.toISOString()}`);
    }
  } else {
    // No next node - mark execution as completed
    await supabase
      .from('playbook_executions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', execution.id);
    
    // 🧪 Update test_run status
    await updateTestRunStatus(supabase, execution, 'done');
    
    
    console.log(`Playbook execution completed: ${execution.id}`);
  }

  return { success: true, delay_days: normalized.duration_days };
}

async function executeTaskNode(supabase: any, item: QueueItem, contact: any) {
  console.log(`Executing task node: ${item.node_id}`);
  
  const taskData = item.node_data;
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

  // Create customer journey step with video, content, and quiz
  const { error: journeyError } = await supabase
    .from('customer_journey_steps')
    .insert({
      contact_id: contact.id,
      step_name: taskData.label || 'Etapa do Onboarding',
      video_url: taskData.video_url || null,
      rich_content: taskData.rich_content || taskData.description || null,
      attachments: taskData.attachments || [],
      quiz_enabled: taskData.quiz_enabled || false,
      quiz_question: taskData.quiz_question || null,
      quiz_options: taskData.quiz_options || [],
      quiz_correct_option: taskData.quiz_correct_option || null,
      is_critical: taskData.is_critical || false,
      notes: taskData.notes || null,
      completed: false,
    });

  if (journeyError) {
    console.error('Failed to create journey step:', journeyError);
    return { success: false, error: journeyError.message };
  }

  // Determine assigned_to: contact.assigned_to → contact.consultant_id → round-robin fallback
  let assignedTo = contact.assigned_to || contact.consultant_id;
  
  if (!assignedTo) {
    console.log('No assigned_to or consultant_id, fetching available agent via round-robin...');
    
    // 1. Buscar IDs de usuarios com roles corretas (query separada para evitar erro de nested query)
    const { data: roleUsers, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['consultant', 'support_agent']);
    
    if (roleError) {
      console.error('Failed to fetch role users:', roleError);
    }
    
    const userIds = roleUsers?.map((r: any) => r.user_id) || [];
    console.log(`Found ${userIds.length} users with consultant/support_agent roles`);
    
    if (userIds.length > 0) {
      // 2. Buscar perfil online dentre esses usuarios
      const { data: agents, error: agentsError } = await supabase
        .from('profiles')
        .select('id')
        .in('id', userIds)
        .eq('status', 'online')
        .limit(1);
      
      if (agentsError) {
        console.error('Failed to fetch online agents:', agentsError);
      }
      
      if (agents && agents.length > 0) {
        assignedTo = agents[0].id;
        console.log('Assigned to available online agent:', assignedTo);
      } else {
        // Nenhum online, pegar o primeiro disponível (sem filtro de status)
        const { data: anyAgents } = await supabase
          .from('profiles')
          .select('id')
          .in('id', userIds)
          .limit(1);
        
        if (anyAgents && anyAgents.length > 0) {
          assignedTo = anyAgents[0].id;
          console.log('Assigned to available (offline) agent:', assignedTo);
        }
      }
    }
    
    // Fallback se ainda não tem agente
    if (!assignedTo) {
      const { data: fallbackAgents } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['consultant', 'admin', 'manager'])
        .limit(1);
      
      if (fallbackAgents && fallbackAgents.length > 0) {
        assignedTo = fallbackAgents[0].user_id;
        console.log('Assigned to fallback agent:', assignedTo);
      }
    }
  }

  // Se ainda não tem agente, criar task sem atribuição (será atribuído manualmente depois)
  if (!assignedTo) {
    console.warn('No agent available, creating task without assignment - will need manual assignment');
    // Continuar mesmo sem assignedTo - task fica sem dono
  }

  // Create activity for assigned person
  const { error: activityError } = await supabase
    .from('activities')
    .insert({
      contact_id: contact.id,
      title: taskData.label || 'Tarefa do Playbook',
      description: taskData.description || '',
      type: 'task',
      assigned_to: assignedTo,
      due_date: dueDate.toISOString(),
      completed: false,
    });

  if (activityError) {
    console.error('Failed to create task:', activityError);
    return { success: false, error: activityError.message };
  }

  console.log('Task and journey step created successfully');
  return { success: true };
}

async function executeCallNode(supabase: any, item: QueueItem, contact: any) {
  console.log(`Executing call node: ${item.node_id}`);
  
  const callData = item.node_data;
  const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // Default 2 days

  // Create call activity
  const { error } = await supabase
    .from('activities')
    .insert({
      contact_id: contact.id,
      title: callData.label || 'Ligação do Playbook',
      description: callData.description || callData.script || '',
      type: 'call',
      assigned_to: contact.assigned_to || contact.consultant_id,
      due_date: dueDate.toISOString(),
      completed: false,
    });

  if (error) {
    console.error('Failed to create call activity:', error);
    return { success: false, error: error.message };
  }

  console.log('Call activity created successfully');
  return { success: true };
}

async function executeFormNode(supabase: any, item: QueueItem, contact: any, execution: PlaybookExecution) {
  console.log(`Executing form node: ${item.node_id}`);
  
  const formData = item.node_data;
  const formId = formData.form_id;
  
  if (!formId) {
    console.error('Form node missing form_id');
    return { success: false, error: 'Formulário não configurado' };
  }

  // Generate public form link with execution context
  const publicFormUrl = `${Deno.env.get('PUBLIC_SITE_URL') || 'https://lovable.app'}/public-form/${formId}?execution_id=${execution.id}&contact_id=${contact.id}`;
  
  console.log(`Generated form link: ${publicFormUrl}`);

  // 🧪 Test mode: override destinatário using helper
  const fallbackName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Cliente';
  const { isTestMode, speedMultiplier, to, to_name } = getEmailTarget(execution, item, contact, fallbackName);

  // Send email/notification to customer with form link
  if (contact.email || isTestMode) {
    const emailSubject = formData.email_subject || 'Por favor, preencha o formulário';
    const finalSubject = isTestMode
      ? (emailSubject.startsWith('[TESTE]') ? emailSubject : `[TESTE] ${emailSubject}`)
      : emailSubject;
    
    const testBanner = isTestMode
      ? `<div style="padding:12px 16px;background:#fef3c7;border:2px dashed #d97706;margin-bottom:16px;font-size:13px;color:#92400e;border-radius:8px;">
          <strong>🧪 EMAIL DE TESTE (FORMULÁRIO)</strong><br/>
          <span style="font-size:12px;">Destinatário original: ${contact.email}</span><br/>
          <span style="font-size:12px;">Speed: ${speedMultiplier}x</span>
        </div>`
      : '';
    
    const { error: emailError } = await supabase.functions.invoke('send-email', {
      body: {
        to: to,
        to_name: to_name,
        subject: finalSubject,
        html: `
          ${testBanner}
          <p>Olá ${contact.first_name || 'Cliente'},</p>
          <p>Precisamos que você preencha o formulário abaixo para continuar:</p>
          <p><a href="${publicFormUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;">Preencher Formulário</a></p>
          <p>Este link é exclusivo para você.</p>
        `,
        customer_id: contact.id,
        playbook_execution_id: execution.id,
      },
    });

    if (emailError) {
      console.error('Failed to send form email:', emailError);
    } else {
      console.log(`${isTestMode ? '🧪 TEST MODE: ' : ''}Form email sent to: ${to}`);
    }
  }

  // If pause_execution is true, mark execution as waiting and don't queue next node
  if (formData.pause_execution) {
    await supabase
      .from('playbook_executions')
      .update({ 
        status: 'waiting_form',
        current_node_id: item.node_id,
      })
      .eq('id', execution.id);

    // Schedule timeout if configured
    if (formData.timeout_days && formData.timeout_days > 0) {
      let timeoutMs = formData.timeout_days * 24 * 60 * 60 * 1000;
      
      // 🧪 Test mode: accelerate timeout
      if (isTestMode && speedMultiplier > 1) {
        const originalMs = timeoutMs;
        timeoutMs = Math.max(5000, Math.floor(timeoutMs / speedMultiplier)); // Minimum 5 seconds
        console.log(`[executeFormNode] 🧪 TEST MODE: Timeout accelerated from ${originalMs}ms to ${timeoutMs}ms`);
      }
      
      const timeoutDate = new Date(Date.now() + timeoutMs);
      
      // Create a timeout check queue item with propagated flags
      await supabase
        .from('playbook_execution_queue')
        .insert({
          execution_id: execution.id,
          node_id: `${item.node_id}_timeout`,
          node_type: 'form_timeout',
          node_data: { 
            original_node_id: item.node_id,
            _test_mode: item.node_data?._test_mode || false,
            _speed_multiplier: item.node_data?._speed_multiplier || 1,
          },
          scheduled_for: timeoutDate.toISOString(),
          status: 'pending',
          retry_count: 0,
          max_retries: 1,
        });
    }

    console.log(`Form node paused execution, waiting for submission: ${execution.id}`);
    return { success: true, paused: true, form_url: publicFormUrl };
  }

  return { success: true, form_url: publicFormUrl };
}

async function executeConditionNode(supabase: any, item: QueueItem, flow: PlaybookFlow, execution: PlaybookExecution) {
  console.log(`Executing condition node: ${item.node_id}`);
  
  const conditionData = item.node_data;
  const conditionType = conditionData.condition_type;
  
  let conditionResult = false;

  switch (conditionType) {
    case 'lead_classification': {
      // Get lead classification from execution context or contact
      const { data: execData } = await supabase
        .from('playbook_executions')
        .select('execution_context, contact_id')
        .eq('id', execution.id)
        .single();
      
      const context = execData?.execution_context || {};
      let leadClassification = context.lead_classification || null;
      
      // If not in context, fetch from contact
      if (!leadClassification && execData?.contact_id) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('lead_classification')
          .eq('id', execData.contact_id)
          .single();
        
        leadClassification = contact?.lead_classification || 'frio';
      }
      
      const expectedClassification = conditionData.expected_classification || 'quente';
      conditionResult = leadClassification?.toLowerCase() === expectedClassification.toLowerCase();
      
      console.log(`Evaluating lead_classification: actual=${leadClassification}, expected=${expectedClassification}, result=${conditionResult}`);
      break;
    }

    case 'form_score': {
      // Get scores from execution context
      const { data: execData } = await supabase
        .from('playbook_executions')
        .select('execution_context')
        .eq('id', execution.id)
        .single();
      
      const context = execData?.execution_context || {};
      const formScores = context.form_scores || {};
      const scoreName = conditionData.score_name || 'leadScoringTotal';
      const scoreValue = formScores[scoreName] ?? context.lead_score ?? 0;
      const threshold = conditionData.score_threshold ?? 0;
      const operator = conditionData.score_operator || 'gte';

      console.log(`Evaluating form_score: ${scoreName}=${scoreValue} ${operator} ${threshold}`);

      switch (operator) {
        case 'gt': conditionResult = scoreValue > threshold; break;
        case 'gte': conditionResult = scoreValue >= threshold; break;
        case 'lt': conditionResult = scoreValue < threshold; break;
        case 'lte': conditionResult = scoreValue <= threshold; break;
        case 'eq': conditionResult = scoreValue === threshold; break;
        default: conditionResult = scoreValue >= threshold;
      }
      break;
    }

    case 'email_opened': {
      // Buscar qual nó de email verificar
      const emailNodeId = conditionData.email_node_id || 
                          conditionData.condition_value?.emailNodeId;
      
      // Exigir email_node_id para evitar falso-positivo
      if (!emailNodeId) {
        console.warn('[condition] email_opened sem email_node_id -> false (evita falso-positivo)');
        conditionResult = false;
        break;
      }
      
      const { data: emailOpened } = await supabase
        .from('email_sends')
        .select('opened_at')
        .eq('playbook_execution_id', execution.id)
        .eq('playbook_node_id', emailNodeId)
        .not('opened_at', 'is', null)
        .limit(1);
      
      conditionResult = (emailOpened?.length || 0) > 0;
      console.log(`⚠️ email_opened é sinal FRACO (pixel bloqueável). Node: ${emailNodeId}, Result: ${conditionResult}`);
      break;
    }

    case 'email_clicked': {
      const emailNodeId = conditionData.email_node_id || 
                          conditionData.condition_value?.emailNodeId;
      
      // Exigir email_node_id para evitar falso-positivo
      if (!emailNodeId) {
        console.warn('[condition] email_clicked sem email_node_id -> false (evita falso-positivo)');
        conditionResult = false;
        break;
      }
      
      const { data: emailClicked } = await supabase
        .from('email_sends')
        .select('clicked_at')
        .eq('playbook_execution_id', execution.id)
        .eq('playbook_node_id', emailNodeId)
        .not('clicked_at', 'is', null)
        .limit(1);
      
      conditionResult = (emailClicked?.length || 0) > 0;
      console.log(`✅ email_clicked é sinal FORTE. Node: ${emailNodeId}, Result: ${conditionResult}`);
      break;
    }

    case 'tag_exists': {
      const tagName = conditionData.condition_value;
      const { data: tags } = await supabase
        .from('customer_tags')
        .select('id, tags!inner(name)')
        .eq('customer_id', execution.contact_id)
        .eq('tags.name', tagName)
        .limit(1);
      
      conditionResult = (tags?.length || 0) > 0;
      break;
    }

    default:
      console.warn(`Unknown condition type: ${conditionType}`);
      conditionResult = true; // Default to true path
  }

  const pathResult = conditionResult ? 'true' : 'false';
  console.log(`Condition result: ${conditionResult}, taking path: ${pathResult}`);

  // Find next node based on condition result (using sourceHandle)
  const nextNodeId = findNextNodeWithHandle(item.node_id, flow, pathResult);
  
  if (!nextNodeId) {
    // No next node for this path - mark execution as completed
    await supabase
      .from('playbook_executions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', execution.id);
    
    // 🧪 Update test_run status
    await updateTestRunStatus(supabase, execution, 'done');
    
    console.log(`No next node for path ${pathResult}, execution completed: ${execution.id}`);
    return { success: true, condition_result: conditionResult, path: pathResult };
  }

  const nextNode = flow.nodes.find(n => n.id === nextNodeId);
  if (!nextNode) {
    console.warn(`Next node not found: ${nextNodeId}`);
    return { success: true, condition_result: conditionResult, path: pathResult };
  }

  // Queue next node based on condition result
  await supabase
    .from('playbook_execution_queue')
    .insert({
      execution_id: execution.id,
      node_id: nextNode.id,
      node_type: nextNode.type,
      node_data: {
        ...nextNode.data,
        _test_mode: item.node_data?._test_mode || false,
        _speed_multiplier: item.node_data?._speed_multiplier || 1,
      },
      scheduled_for: new Date().toISOString(),
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
    });

  console.log(`Queued next node ${nextNode.id} for path ${pathResult}`);
  return { success: true, condition_result: conditionResult, path: pathResult };
}

async function executeSwitchNode(supabase: any, item: QueueItem, flow: PlaybookFlow, execution: PlaybookExecution) {
  console.log(`Executing switch node: ${item.node_id}`);
  
  const switchData = item.node_data;
  const switchType = switchData.switch_type || 'lead_classification';
  
  let selectedCase: string | null = null;

  switch (switchType) {
    case 'lead_classification': {
      // Get lead classification from execution context or contact
      const { data: execData } = await supabase
        .from('playbook_executions')
        .select('execution_context, contact_id')
        .eq('id', execution.id)
        .single();
      
      const context = execData?.execution_context || {};
      let leadClassification = context.lead_classification || null;
      
      // If not in context, fetch from contact
      if (!leadClassification && execData?.contact_id) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('lead_classification')
          .eq('id', execData.contact_id)
          .single();
        
        leadClassification = contact?.lead_classification || 'frio';
      }
      
      selectedCase = (leadClassification || 'frio').toLowerCase();
      console.log(`Switch lead_classification: ${selectedCase}`);
      break;
    }

    default:
      console.warn(`Unknown switch type: ${switchType}`);
      selectedCase = switchData.cases?.[0]?.id || null; // Default to first case
  }

  if (!selectedCase) {
    console.error('No case selected for switch node');
    return { success: false, error: 'Nenhum caso selecionado para o switch' };
  }

  // Find next node based on selected case (using sourceHandle)
  const nextNodeId = findNextNodeWithHandle(item.node_id, flow, selectedCase);
  
  if (!nextNodeId) {
    // No next node for this case - mark execution as completed
    await supabase
      .from('playbook_executions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', execution.id);
    
    // 🧪 Update test_run status
    await updateTestRunStatus(supabase, execution, 'done');
    
    console.log(`No next node for case ${selectedCase}, execution completed: ${execution.id}`);
    return { success: true, selected_case: selectedCase, message: 'No path for this case' };
  }

  const nextNode = flow.nodes.find(n => n.id === nextNodeId);
  if (!nextNode) {
    console.warn(`Next node not found: ${nextNodeId}`);
    return { success: true, selected_case: selectedCase };
  }

  // ============ ADD JOURNEY STEPS FOR THE SELECTED PATH ============
  // Collect all task nodes reachable from this path
  const pathNodes: Array<{ id: string; type: string; data: any }> = [];
  let currentNodeId: string | null = nextNodeId;
  
  while (currentNodeId) {
    const node = flow.nodes.find(n => n.id === currentNodeId);
    if (!node) break;
    
    // Only add task nodes to journey (visual steps)
    if (node.type === 'task') {
      pathNodes.push(node);
    }
    
    // Stop if we hit another branching node or form
    if (node.type === 'switch' || node.type === 'condition' || node.type === 'form') {
      break;
    }
    
    // Find next node in sequence
    currentNodeId = findNextNode(currentNodeId, flow);
  }

  console.log(`Adding ${pathNodes.length} journey steps for path "${selectedCase}"`);

  // Get current max position for this contact's journey
  const { data: existingSteps } = await supabase
    .from('customer_journey_steps')
    .select('position')
    .eq('contact_id', execution.contact_id)
    .order('position', { ascending: false })
    .limit(1);

  let nextPosition = (existingSteps?.[0]?.position || 0) + 1;

  // Add journey steps for the path
  for (const node of pathNodes) {
    const nodeData = node.data || {};
    
    const { error: stepError } = await supabase
      .from('customer_journey_steps')
      .insert({
        contact_id: execution.contact_id,
        step_name: nodeData.label || `Etapa ${nextPosition}`,
        position: nextPosition,
        step_type: 'task',
        is_critical: nodeData.quiz_enabled || false,
        video_url: nodeData.video_url || null,
        rich_content: nodeData.rich_content || null,
        attachments: nodeData.attachments || null,
        quiz_enabled: nodeData.quiz_enabled || false,
        quiz_question: nodeData.quiz_question || null,
        quiz_options: nodeData.quiz_options || null,
        quiz_correct_option: nodeData.quiz_correct_option || null,
        completed: false,
        quiz_passed: false,
      });

    if (stepError) {
      console.error(`Failed to add journey step for path:`, stepError);
    } else {
      console.log(`Added journey step: ${nodeData.label} at position ${nextPosition}`);
    }
    
    nextPosition++;
  }

  // Queue next node based on selected case
  await supabase
    .from('playbook_execution_queue')
    .insert({
      execution_id: execution.id,
      node_id: nextNode.id,
      node_type: nextNode.type,
      node_data: {
        ...nextNode.data,
        _test_mode: item.node_data?._test_mode || false,
        _speed_multiplier: item.node_data?._speed_multiplier || 1,
      },
      scheduled_for: new Date().toISOString(),
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
    });

  console.log(`Queued next node ${nextNode.id} for case ${selectedCase}`);
  return { success: true, selected_case: selectedCase, steps_added: pathNodes.length };
}
async function queueNextNode(supabase: any, currentItem: QueueItem, flow: PlaybookFlow, execution: PlaybookExecution) {
  const nextNodeId = findNextNode(currentItem.node_id, flow);
  
  if (!nextNodeId) {
    // No next node - mark execution as completed
    await supabase
      .from('playbook_executions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', execution.id);
    
    // 🧪 Update test_run status
    await updateTestRunStatus(supabase, execution, 'done');
    
    console.log(`Playbook execution completed: ${execution.id}`);
    return;
  }

  const nextNode = flow.nodes.find(n => n.id === nextNodeId);
  if (!nextNode) {
    console.warn(`Next node not found: ${nextNodeId}`);
    return;
  }

  // Queue next node for immediate processing
  await supabase
    .from('playbook_execution_queue')
    .insert({
      execution_id: execution.id,
      node_id: nextNode.id,
      node_type: nextNode.type,
      node_data: {
        ...nextNode.data,
        _test_mode: currentItem.node_data?._test_mode || false,
        _speed_multiplier: currentItem.node_data?._speed_multiplier || 1,
      },
      scheduled_for: new Date().toISOString(),
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
    });
  
  console.log(`Next node queued: ${nextNode.id} (type: ${nextNode.type})`);
}

function findNextNode(currentNodeId: string, flow: PlaybookFlow): string | null {
  const edge = flow.edges.find(e => e.source === currentNodeId);
  return edge ? edge.target : null;
}

function findNextNodeWithHandle(currentNodeId: string, flow: PlaybookFlow, sourceHandle: string): string | null {
  // For condition nodes, find edge with matching sourceHandle (true/false)
  const edge = flow.edges.find(e => 
    e.source === currentNodeId && 
    (e as any).sourceHandle === sourceHandle
  );
  return edge ? edge.target : null;
}
