import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

    // Fetch pending queue items
    const { data: queueItems, error: queueError } = await supabaseAdmin
      .from('playbook_execution_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(10);

    if (queueError) {
      console.error('Failed to fetch queue items:', queueError);
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No pending queue items found');
      return new Response(
        JSON.stringify({ message: 'No items to process', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${queueItems.length} queue items to process`);

    let processedCount = 0;
    let failedCount = 0;

    for (const item of queueItems as QueueItem[]) {
      try {
        console.log(`Processing queue item: id=${item.id}, type=${item.node_type}, execution=${item.execution_id}`);

        // Mark as processing
        await supabaseAdmin
          .from('playbook_execution_queue')
          .update({ status: 'processing' })
          .eq('id', item.id);

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

        // Queue next node if not a delay (delay queues internally)
        if (item.node_type !== 'delay') {
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
          const { data: execution } = await supabaseAdmin
            .from('playbook_executions')
            .select('errors')
            .eq('id', item.execution_id)
            .single();

          const errors = [...(execution?.errors || [])];
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
  
  const emailData = item.node_data;
  
  // Call send-email edge function
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: {
      to: contact.email,
      subject: emailData.subject || 'Mensagem da equipe',
      html: emailData.body || emailData.message || '',
      contact_id: contact.id,
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
  
  const durationDays = item.node_data.duration_days || 1;
  const nextExecutionTime = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

  console.log(`Delay of ${durationDays} days, next execution: ${nextExecutionTime.toISOString()}`);

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
          node_data: nextNode.data,
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
    
    console.log(`Playbook execution completed: ${execution.id}`);
  }

  return { success: true, delay_days: durationDays };
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

  // Create activity for assigned person
  const { error: activityError } = await supabase
    .from('activities')
    .insert({
      contact_id: contact.id,
      title: taskData.label || 'Tarefa do Playbook',
      description: taskData.description || '',
      type: 'task',
      assigned_to: contact.assigned_to || contact.consultant_id,
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

async function queueNextNode(supabase: any, currentItem: QueueItem, flow: PlaybookFlow, execution: PlaybookExecution) {
  const nextNodeId = findNextNode(currentItem.node_id, flow);
  
  if (!nextNodeId) {
    // No next node - mark execution as completed
    await supabase
      .from('playbook_executions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', execution.id);
    
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
      node_data: nextNode.data,
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
