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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { form_id, current_field_index, answers, persona_id } = await req.json();

    if (!form_id) {
      return new Response(
        JSON.stringify({ error: 'form_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch form
    const { data: form } = await supabase
      .from('forms')
      .select('*')
      .eq('id', form_id)
      .single();

    if (!form) {
      return new Response(
        JSON.stringify({ error: 'Form not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fields = form.fields as any[];
    const remainingFields = fields.slice(current_field_index + 1);

    if (remainingFields.length === 0) {
      return new Response(
        JSON.stringify({ 
          suggestion: null,
          next_field_index: null,
          message: 'Todas as perguntas foram respondidas!' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch conditions to determine which fields should be shown
    const { data: conditions } = await supabase
      .from('form_conditions')
      .select('*')
      .eq('form_id', form_id);

    // Evaluate which fields should be visible based on conditions
    const visibleFields = remainingFields.filter(field => {
      const fieldConditions = conditions?.filter(c => c.target_field_id === field.id && c.condition_type === 'hide_field');
      
      if (!fieldConditions || fieldConditions.length === 0) return true;

      // Check if any hide condition is met
      for (const condition of fieldConditions) {
        const fieldValue = answers[condition.field_id];
        let conditionMet = false;

        switch (condition.operator) {
          case 'equals':
            conditionMet = fieldValue == condition.value;
            break;
          case 'not_equals':
            conditionMet = fieldValue != condition.value;
            break;
          case 'contains':
            conditionMet = String(fieldValue).includes(String(condition.value));
            break;
          case 'is_empty':
            conditionMet = !fieldValue || fieldValue === '';
            break;
          case 'is_not_empty':
            conditionMet = !!fieldValue && fieldValue !== '';
            break;
        }

        if (conditionMet) return false; // Hide this field
      }

      return true;
    });

    if (visibleFields.length === 0) {
      return new Response(
        JSON.stringify({ 
          suggestion: null,
          next_field_index: null,
          message: 'Formulário concluído!' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get AI model config
    const { data: modelConfig } = await supabase
      .from('system_configurations')
      .select('value')
      .eq('key', 'ai_model_sandbox')
      .single();

    const model = 'gpt-5-mini';

    // Fetch persona if provided
    let personaPrompt = '';
    if (persona_id) {
      const { data: persona } = await supabase
        .from('ai_personas')
        .select('system_prompt, name')
        .eq('id', persona_id)
        .single();
      
      if (persona) {
        personaPrompt = `Você está representando a persona "${persona.name}". ${persona.system_prompt}\n\n`;
      }
    }

    // Build context for AI
    const answeredFields = fields.slice(0, current_field_index + 1);
    const answersContext = answeredFields.map(f => ({
      question: f.label,
      answer: answers[f.id] || '(não respondido)',
    }));

    const nextFieldOptions = visibleFields.slice(0, 3).map(f => ({
      id: f.id,
      label: f.label,
      type: f.type,
      index: fields.findIndex(field => field.id === f.id),
    }));

    // Call AI for suggestion
    const aiPrompt = `${personaPrompt}Você é um assistente inteligente de formulários. Com base nas respostas anteriores, sugira qual pergunta deve ser feita a seguir.

Respostas até agora:
${answersContext.map(a => `- ${a.question}: ${a.answer}`).join('\n')}

Próximas perguntas disponíveis:
${nextFieldOptions.map((f, i) => `${i + 1}. ${f.label} (tipo: ${f.type})`).join('\n')}

Responda APENAS com um JSON no formato:
{
  "selected_index": <número da pergunta escolhida (1, 2 ou 3)>,
  "transition_message": "<mensagem curta e amigável para transição, máximo 50 caracteres>",
  "reason": "<breve justificativa da escolha>"
}`;

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: aiPrompt }],
        max_completion_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      // Fallback to first visible field
      const nextField = visibleFields[0];
      return new Response(
        JSON.stringify({
          suggestion: {
            field: nextField,
            next_field_index: fields.findIndex(f => f.id === nextField.id),
            transition_message: 'Continuando...',
          },
          ai_available: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '';

    try {
      // Parse AI response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const selectedOption = nextFieldOptions[parsed.selected_index - 1] || nextFieldOptions[0];
        const nextField = visibleFields.find(f => f.id === selectedOption.id) || visibleFields[0];

        return new Response(
          JSON.stringify({
            suggestion: {
              field: nextField,
              next_field_index: fields.findIndex(f => f.id === nextField.id),
              transition_message: parsed.transition_message || 'Próxima pergunta:',
              reason: parsed.reason,
            },
            ai_available: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (parseError) {
      console.error('[form-ai-suggest] Parse error:', parseError);
    }

    // Fallback
    const nextField = visibleFields[0];
    return new Response(
      JSON.stringify({
        suggestion: {
          field: nextField,
          next_field_index: fields.findIndex(f => f.id === nextField.id),
          transition_message: 'Continuando...',
        },
        ai_available: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[form-ai-suggest] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
