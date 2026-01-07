import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExecutePlaybookRequest {
  playbook_id: string;
  contact_id: string;
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { playbook_id, contact_id }: ExecutePlaybookRequest = await req.json();

    if (!playbook_id || !contact_id) {
      return new Response(
        JSON.stringify({ error: 'playbook_id and contact_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting playbook execution: playbook_id=${playbook_id}, contact_id=${contact_id}, user_id=${user.id}`);

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

    // Verify contact exists
    const { data: contact, error: contactError } = await supabaseClient
      .from('contacts')
      .select('id, first_name, last_name, email')
      .eq('id', contact_id)
      .single();

    if (contactError || !contact) {
      console.error('Contact not found:', contactError);
      return new Response(
        JSON.stringify({ error: 'Contact not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const flow = playbook.flow_definition as PlaybookFlow;
    const nodes = flow.nodes || [];

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
        contact_id,
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

    console.log(`Execution created: execution_id=${execution.id}`);

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

    console.log(`First node queued: node_id=${firstNode.id}, type=${firstNode.type}`);

    // Log interaction
    await supabaseClient
      .from('interactions')
      .insert({
        customer_id: contact_id,
        type: 'note',
        content: `Playbook "${playbook.name}" iniciado automaticamente`,
        channel: 'other',
        created_by: user.id,
        metadata: {
          playbook_id,
          playbook_execution_id: execution.id,
          trigger: 'manual',
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        execution_id: execution.id,
        message: `Playbook execution started successfully`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error in execute-playbook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
