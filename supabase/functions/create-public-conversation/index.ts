import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { department_id } = await req.json();

    if (!department_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'department_id é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validar que departamento existe e está ativo
    const { data: department, error: deptError } = await supabase
      .from('departments')
      .select('id, name, is_active')
      .eq('id', department_id)
      .eq('is_active', true)
      .single();

    if (deptError || !department) {
      return new Response(
        JSON.stringify({ success: false, error: 'Departamento não encontrado ou inativo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Criar contato provisório (guest)
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        first_name: 'Visitante',
        last_name: `#${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        email: `guest-${Date.now()}@temp.com`,
        source: 'chat_widget',
      })
      .select()
      .single();

    if (contactError || !contact) {
      console.error('[create-public-conversation] Error creating contact:', contactError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar contato' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Criar conversa pública
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        contact_id: contact.id,
        department: department_id,
        channel: 'web_chat',
        status: 'open',
        ai_mode: 'autopilot', // Inicia no modo autopilot
      })
      .select()
      .single();

    if (convError || !conversation) {
      console.error('[create-public-conversation] Error creating conversation:', convError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar conversa' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Registrar interaction inicial
    await supabase
      .from('interactions')
      .insert({
        customer_id: contact.id,
        type: 'note',
        content: `Conversa pública iniciada via widget de chat (Departamento: ${department.name})`,
        channel: 'other',
        metadata: {
          conversation_id: conversation.id,
          department_id: department_id,
          department_name: department.name,
          source: 'public_chat_widget',
        },
      });

    console.log('[create-public-conversation] Success:', { conversation_id: conversation.id });

    return new Response(
      JSON.stringify({
        success: true,
        conversation_id: conversation.id,
        contact_id: contact.id,
        department_name: department.name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[create-public-conversation] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
