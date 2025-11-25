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

    const { department_id, contact_id, customer_data } = await req.json();

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

    let finalContactId = contact_id;
    let customerMetadata: {
      is_returning_customer?: boolean;
      previous_interactions_count?: number;
      identified_at?: string;
    } = {};
    
    // FASE 2: Identity Resolution
    // Se customer_data foi fornecido, fazer upsert do contato
    if (customer_data && customer_data.email) {
      console.log('[create-public-conversation] Identity Resolution - upserting contact:', customer_data.email);
      
      // Chamar função upsert_contact_with_interaction
      const { data: upsertResult, error: upsertError } = await supabase
        .rpc('upsert_contact_with_interaction', {
          p_email: customer_data.email,
          p_first_name: customer_data.first_name || 'Visitante',
          p_last_name: customer_data.last_name || '',
          p_phone: customer_data.phone || null,
          p_company: customer_data.company || null,
          p_source: 'chat_widget',
        });

      if (upsertError) {
        console.error('[create-public-conversation] Upsert error:', upsertError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao processar contato' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      finalContactId = upsertResult[0].contact_id;
      const isNewContact = upsertResult[0].is_new_contact;

      // Contar interações anteriores se é cliente recorrente
      let previousInteractionsCount = 0;
      if (!isNewContact) {
        const { count } = await supabase
          .from('interactions')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', finalContactId);
        
        previousInteractionsCount = count || 0;
      }

      customerMetadata = {
        is_returning_customer: !isNewContact,
        previous_interactions_count: previousInteractionsCount,
        identified_at: new Date().toISOString(),
      };

      console.log('[create-public-conversation] Identity resolved:', {
        contact_id: finalContactId,
        is_returning_customer: !isNewContact,
        previous_interactions_count: previousInteractionsCount,
      });
    } else if (!finalContactId) {
      // Fallback: criar contato provisório (guest) - backward compatibility
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
      
      finalContactId = contact.id;
    }

    // Criar conversa pública com customer_metadata
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        contact_id: finalContactId,
        department: department_id,
        channel: 'web_chat',
        status: 'open',
        ai_mode: 'autopilot',
        customer_metadata: customerMetadata,
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
        customer_id: finalContactId,
        type: 'note',
        content: `Conversa pública iniciada via widget de chat (Departamento: ${department.name})`,
        channel: 'other',
        metadata: {
          conversation_id: conversation.id,
          department_id: department_id,
          department_name: department.name,
          source: 'public_chat_widget',
          customer_metadata: customerMetadata,
        },
      });

    console.log('[create-public-conversation] Success:', { 
      conversation_id: conversation.id, 
      contact_id: finalContactId,
      is_returning_customer: customerMetadata.is_returning_customer || false,
    });

    return new Response(
      JSON.stringify({
        success: true,
        conversation_id: conversation.id,
        contact_id: finalContactId,
        department_name: department.name,
        is_returning_customer: customerMetadata.is_returning_customer || false,
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
