import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Expected paths:
    // /form-public-api/{form_id}/schema
    // /form-public-api/{form_id}/logic
    // /form-public-api/{form_id}/submit
    
    const formId = pathParts[1];
    const action = pathParts[2];

    if (!formId) {
      return new Response(
        JSON.stringify({ error: 'Form ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch form
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .eq('is_active', true)
      .single();

    if (formError || !form) {
      return new Response(
        JSON.stringify({ error: 'Form not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /schema - Public endpoint for form structure
    if (action === 'schema' && req.method === 'GET') {
      const fields = (form.fields as any[]).map(field => ({
        id: field.id,
        type: field.type,
        label: field.label,
        placeholder: field.placeholder,
        required: field.required,
        options: field.options,
        validation_type: field.validation_type,
        validation_message: field.validation_message,
      }));

      return new Response(
        JSON.stringify({
          id: form.id,
          name: form.name,
          description: form.description,
          fields,
          settings: form.settings,
          theme: form.theme,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /logic - Protected endpoint for full logic (requires API key)
    if (action === 'logic' && req.method === 'GET') {
      const apiKey = req.headers.get('x-api-key');
      
      // Verify API key (you can implement your own key validation)
      const { data: keyData } = await supabase
        .from('system_configurations')
        .select('value')
        .eq('key', 'forms_api_key')
        .single();

      if (!apiKey || apiKey !== keyData?.value) {
        return new Response(
          JSON.stringify({ error: 'Invalid or missing API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch conditions
      const { data: conditions } = await supabase
        .from('form_conditions')
        .select('*')
        .eq('form_id', formId);

      // Fetch calculations
      const { data: calculations } = await supabase
        .from('form_calculations')
        .select('*')
        .eq('form_id', formId);

      // Fetch automations (without sensitive action configs)
      const { data: automations } = await supabase
        .from('form_automations')
        .select('id, name, trigger_type, trigger_config, action_type, is_active, priority')
        .eq('form_id', formId)
        .eq('is_active', true);

      return new Response(
        JSON.stringify({
          form_id: formId,
          conditions: conditions || [],
          calculations: calculations || [],
          automations: automations || [],
          conditional_logic: form.conditional_logic,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /submit - Public endpoint for form submission
    if (action === 'submit' && req.method === 'POST') {
      const body = await req.json();
      
      // Forward to form-submit-v3
      const { data, error } = await supabase.functions.invoke('form-submit-v3', {
        body: {
          form_id: formId,
          answers: body.answers || body,
          session_metadata: {
            user_agent: req.headers.get('user-agent'),
            origin: req.headers.get('origin'),
            submitted_at: new Date().toISOString(),
          },
        },
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Submission failed', details: error }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid endpoint. Use /schema, /logic, or /submit' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[form-public-api] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
