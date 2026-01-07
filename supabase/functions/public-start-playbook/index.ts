import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StartPlaybookRequest {
  playbook_id: string;
  email: string;
  first_name: string;
  last_name?: string;
  phone?: string;
}

interface PlaybookNode {
  id: string;
  type: string;
  data: {
    label: string;
    [key: string]: any;
  };
  position?: { x: number; y: number };
}

interface PlaybookFlow {
  nodes: PlaybookNode[];
  edges: Array<{ source: string; target: string }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role for public access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { playbook_id, email, first_name, last_name, phone }: StartPlaybookRequest = await req.json();

    if (!playbook_id || !email || !first_name) {
      return new Response(
        JSON.stringify({ error: 'playbook_id, email and first_name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[public-start-playbook] Starting for playbook_id=${playbook_id}, email=${email}`);

    // Fetch playbook
    const { data: playbook, error: playbookError } = await supabaseClient
      .from('onboarding_playbooks')
      .select('*')
      .eq('id', playbook_id)
      .single();

    if (playbookError || !playbook) {
      console.error('Playbook not found:', playbookError);
      return new Response(
        JSON.stringify({ error: 'Playbook not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!playbook.is_active) {
      return new Response(
        JSON.stringify({ error: 'Playbook is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find or create contact by email
    let contact;
    const { data: existingContact } = await supabaseClient
      .from('contacts')
      .select('id, first_name, last_name, email')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existingContact) {
      contact = existingContact;
      console.log(`[public-start-playbook] Found existing contact: ${contact.id}`);
    } else {
      // Create new contact
      const { data: newContact, error: contactError } = await supabaseClient
        .from('contacts')
        .insert({
          email: email.toLowerCase().trim(),
          first_name: first_name.trim(),
          last_name: last_name?.trim() || '',
          phone: phone?.trim(),
          source: 'playbook_link',
        })
        .select()
        .single();

      if (contactError || !newContact) {
        console.error('Failed to create contact:', contactError);
        return new Response(
          JSON.stringify({ error: 'Failed to create contact' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      contact = newContact;
      console.log(`[public-start-playbook] Created new contact: ${contact.id}`);
    }

    // Check if there's already an active execution for this contact+playbook
    const { data: existingExecution } = await supabaseClient
      .from('playbook_executions')
      .select('id, status')
      .eq('playbook_id', playbook_id)
      .eq('contact_id', contact.id)
      .in('status', ['pending', 'running'])
      .maybeSingle();

    if (existingExecution) {
      console.log(`[public-start-playbook] Found existing execution: ${existingExecution.id}`);
      return new Response(
        JSON.stringify({
          success: true,
          execution_id: existingExecution.id,
          message: 'Using existing execution',
          is_existing: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const flow = playbook.flow_definition as PlaybookFlow;
    const nodes = flow?.nodes || [];

    if (nodes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Playbook has no nodes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create execution record
    const { data: execution, error: executionError } = await supabaseClient
      .from('playbook_executions')
      .insert({
        playbook_id,
        contact_id: contact.id,
        status: 'running',
        current_node_id: nodes[0].id,
        nodes_executed: [],
        errors: [],
      })
      .select()
      .single();

    if (executionError || !execution) {
      console.error('Failed to create execution:', executionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create execution record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[public-start-playbook] Execution created: ${execution.id}`);

    // Reset journey steps for this contact to guarantee a clean onboarding start
    // (prevents immediately landing on the completion screen due to old/completed steps)
    const { error: resetStepsError } = await supabaseClient
      .from('customer_journey_steps')
      .delete()
      .eq('contact_id', contact.id);

    if (resetStepsError) {
      console.error('[public-start-playbook] Failed to reset journey steps:', resetStepsError);
      // Don't hard-fail here: we can still attempt to insert fresh steps below.
    } else {
      console.log(`[public-start-playbook] Journey steps reset for contact ${contact.id}`);
    }

    // Create customer_journey_steps from playbook task AND form nodes
    // Filter nodes up to the first switch node (the rest will be added after form submission)
    const visualNodes: PlaybookNode[] = [];
    for (const node of nodes) {
      if (node.type === 'switch' || node.type === 'condition') {
        // Stop at branching nodes - the rest will be added dynamically after form submit
        break;
      }
      if (node.type === 'task' || node.type === 'form') {
        visualNodes.push(node);
      }
    }
    
    console.log(`[public-start-playbook] Creating ${visualNodes.length} journey steps (tasks + forms)`);

    for (let i = 0; i < visualNodes.length; i++) {
      const node = visualNodes[i];
      const nodeData = node.data || {};

      const stepData: Record<string, any> = {
        contact_id: contact.id,
        step_name: nodeData.label || `Etapa ${i + 1}`,
        position: i + 1,
        step_type: node.type, // 'task' or 'form'
        completed: false,
      };

      // Add task-specific fields
      if (node.type === 'task') {
        stepData.is_critical = nodeData.quiz_enabled || false;
        stepData.video_url = nodeData.video_url || null;
        stepData.rich_content = nodeData.rich_content || null;
        stepData.attachments = nodeData.attachments || null;
        stepData.quiz_enabled = nodeData.quiz_enabled || false;
        stepData.quiz_question = nodeData.quiz_question || null;
        stepData.quiz_options = nodeData.quiz_options || null;
        stepData.quiz_correct_option = nodeData.quiz_correct_option || null;
        stepData.quiz_passed = false;
      }

      // Add form-specific fields
      if (node.type === 'form') {
        stepData.form_id = nodeData.form_id || null;
        stepData.is_critical = true; // Forms are always critical to progress
      }

      const { error: stepError } = await supabaseClient
        .from('customer_journey_steps')
        .insert(stepData);

      if (stepError) {
        console.error(`Failed to create journey step ${i + 1}:`, stepError);
      } else {
        console.log(`[public-start-playbook] Created journey step: ${nodeData.label} (type: ${node.type})`);
      }
    }

    console.log(`[public-start-playbook] All initial journey steps created for contact ${contact.id}`);

    // Queue first node for processing
    const firstNode = nodes[0];
    const { error: queueError } = await supabaseClient
      .from('playbook_execution_queue')
      .insert({
        execution_id: execution.id,
        node_id: firstNode.id,
        node_type: firstNode.type,
        node_data: firstNode.data,
        scheduled_for: new Date().toISOString(),
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
      });

    if (queueError) {
      console.error('Failed to queue first node:', queueError);
      
      // Update execution status to failed
      await supabaseClient
        .from('playbook_executions')
        .update({ 
          status: 'failed',
          errors: [{ message: 'Failed to queue first node', error: queueError.message }]
        })
        .eq('id', execution.id);

      return new Response(
        JSON.stringify({ error: 'Failed to queue playbook execution' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[public-start-playbook] First node queued: ${firstNode.id}`);

    // Log interaction
    await supabaseClient
      .from('interactions')
      .insert({
        customer_id: contact.id,
        type: 'note',
        content: `Playbook "${playbook.name}" iniciado via link público`,
        channel: 'other',
        metadata: {
          playbook_id,
          playbook_execution_id: execution.id,
          trigger: 'public_link',
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        execution_id: execution.id,
        contact_id: contact.id,
        message: 'Playbook execution started successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[public-start-playbook] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
