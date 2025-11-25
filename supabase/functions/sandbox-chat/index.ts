import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, personaId } = await req.json();
    
    console.log('[sandbox-chat] Processing request for persona:', personaId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch persona details
    const { data: persona, error: personaError } = await supabase
      .from('ai_personas')
      .select(`
        *,
        ai_persona_tools (
          ai_tools (
            id,
            name,
            description,
            function_schema,
            is_enabled
          )
        )
      `)
      .eq('id', personaId)
      .single();

    if (personaError || !persona) {
      console.error('[sandbox-chat] Error fetching persona:', personaError);
      return new Response(
        JSON.stringify({ error: 'Persona not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[sandbox-chat] Persona loaded:', persona.name);

    // Build tools array from persona's linked tools
    const tools = persona.ai_persona_tools
      ?.filter((pt: any) => pt.ai_tools?.is_enabled)
      .map((pt: any) => ({
        type: "function",
        function: pt.ai_tools.function_schema
      })) || [];

    console.log('[sandbox-chat] Available tools:', tools.length);

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiMessages = [
      { role: "system", content: persona.system_prompt },
      ...messages
    ];

    const aiPayload: any = {
      model: "google/gemini-2.5-flash",
      messages: aiMessages,
      temperature: persona.temperature || 0.7,
      max_tokens: persona.max_tokens || 500,
    };

    // Only add tools if persona has any
    if (tools.length > 0) {
      aiPayload.tools = tools;
    }

    console.log('[sandbox-chat] Calling Lovable AI with', aiMessages.length, 'messages');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(aiPayload),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[sandbox-chat] AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI API error: ${aiResponse.status} ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('[sandbox-chat] AI response received');

    const choice = aiData.choices[0];
    const message = choice.message;

    // Extract tool calls if present
    const toolCalls = message.tool_calls || [];
    console.log('[sandbox-chat] Tool calls:', toolCalls.length);

    return new Response(
      JSON.stringify({
        content: message.content || '',
        tool_calls: toolCalls,
        persona: {
          name: persona.name,
          role: persona.role,
          temperature: persona.temperature,
        },
        debug: {
          model: "google/gemini-2.5-flash",
          prompt_tokens: aiData.usage?.prompt_tokens || 0,
          completion_tokens: aiData.usage?.completion_tokens || 0,
          total_tokens: aiData.usage?.total_tokens || 0,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sandbox-chat] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
