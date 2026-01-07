import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    const { department_id: requestedDepartmentId, contact_id, customer_data, session_verified } = await req.json();

    // FASE 5: Departamento Automático - determinar baseado no contexto do cliente
    let finalDepartmentId = requestedDepartmentId;
    
    // Se contact_id fornecido, buscar status do cliente para routing inteligente
    if (contact_id && !requestedDepartmentId) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('status')
        .eq('id', contact_id)
        .single();
      
      if (contact?.status === 'customer') {
        // Cliente existente → Suporte
        const { data: supportDept } = await supabase
          .from('departments')
          .select('id')
          .eq('name', 'Suporte')
          .eq('is_active', true)
          .single();
        
        finalDepartmentId = supportDept?.id || requestedDepartmentId;
        console.log('[create-public-conversation] Auto-routing customer to Suporte:', finalDepartmentId);
      } else {
        // Lead/prospect → Comercial
        const { data: salesDept } = await supabase
          .from('departments')
          .select('id')
          .eq('name', 'Comercial')
          .eq('is_active', true)
          .single();
        
        finalDepartmentId = salesDept?.id || requestedDepartmentId;
        console.log('[create-public-conversation] Auto-routing lead to Comercial:', finalDepartmentId);
      }
    }

    // FASE 4: Rate Limiting por IP (10 conversas por minuto por IP anônimo)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    
    const { data: rateLimitAllowed, error: rateLimitError } = await supabase
      .rpc('check_rate_limit', {
        p_identifier: `ip_${ip}`,
        p_action_type: 'create_conversation',
        p_max_requests: 10,
        p_window_minutes: 1,
        p_block_minutes: 60
      });

    if (rateLimitError) {
      console.error('[create-public-conversation] Erro ao verificar rate limit:', rateLimitError);
    }

    if (rateLimitAllowed === false) {
      console.warn('[create-public-conversation] Rate limit excedido para IP:', ip);
      return new Response(
        JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    if (!finalDepartmentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'department_id é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validar que departamento existe e está ativo
    const { data: department, error: deptError } = await supabase
      .from('departments')
      .select('id, name, is_active')
      .eq('id', finalDepartmentId)
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
      session_verified?: boolean;
    } = {
      session_verified: session_verified ?? true,
    };
    
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
          p_organization_id: null,
          p_source: 'chat_widget',
          p_assigned_to: null,
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
        session_verified: session_verified ?? true,
      };

      console.log('[create-public-conversation] Identity resolved:', {
        contact_id: finalContactId,
        is_returning_customer: !isNewContact,
        previous_interactions_count: previousInteractionsCount,
      });
    } else if (!finalContactId && !customer_data?.email) {
      // BLOQUEIO: Não permitir conversas anônimas - Email é obrigatório
      console.error('[create-public-conversation] BLOCKED: No contact_id or email provided');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Identificação obrigatória. Por favor, informe seu e-mail para iniciar o chat.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // NUCLEAR FIX: Usar RPC atômica para Get or Create (com reabertura automática)
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('get_or_create_conversation', {
        p_contact_id: finalContactId,
        p_department_id: finalDepartmentId,
        p_channel: 'web_chat'
      })
      .single();

    if (rpcError) {
      console.error('[create-public-conversation] RPC error:', rpcError);
      throw new Error(`Failed to get or create conversation: ${rpcError.message}`);
    }

    const { conversation_id, is_existing, was_reopened } = rpcResult as {
      conversation_id: string;
      is_existing: boolean;
      was_reopened: boolean;
    };

    console.log('[create-public-conversation] RPC result:', { 
      conversation_id, 
      is_existing, 
      was_reopened 
    });

    // SECURITY: Generate session token for new conversations
    let sessionToken: string | null = null;
    
    if (!is_existing) {
      // Generate secure session token for new conversations
      const { data: tokenData, error: tokenError } = await supabase
        .rpc('generate_session_token')
        .single();
      
      if (tokenError) {
        console.error('[create-public-conversation] Error generating token:', tokenError);
      } else {
        sessionToken = tokenData as string;
        
        // Update conversation with session_token
        await supabase
          .from('conversations')
          .update({ session_token: sessionToken })
          .eq('id', conversation_id);
        
        console.log('[create-public-conversation] ✅ Session token generated and assigned');
      }
    } else {
      // For existing conversations, retrieve the existing token
      const { data: conv } = await supabase
        .from('conversations')
        .select('session_token')
        .eq('id', conversation_id)
        .single();
      
      sessionToken = conv?.session_token || null;
      console.log('[create-public-conversation] Retrieved existing session token');
    }

    console.log('[create-public-conversation] RPC result:', { 
      conversation_id, 
      is_existing, 
      was_reopened,
      has_session_token: !!sessionToken
    });

    // Se foi reaberta, registrar nota no timeline
    if (was_reopened) {
      await supabase.from('interactions').insert({
        customer_id: finalContactId,
        type: 'note',
        content: `Conversa reaberta pelo cliente via chat widget (Departamento: ${department.name})`,
        channel: 'other',
        metadata: {
          conversation_id,
          reopened_at: new Date().toISOString(),
          department_name: department.name,
        },
      });
    }

    // Se conversa já existia (aberta ou reaberta), retornar ela
    if (is_existing) {
      return new Response(
        JSON.stringify({
          success: true,
          conversation_id,
          contact_id: finalContactId,
          department_name: department.name,
          is_returning_customer: customerMetadata.is_returning_customer || false,
          is_existing_conversation: true,
          was_reopened,
          session_token: sessionToken, // SECURITY: Return token for session scoping
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Nova conversa criada pela RPC - registrar interaction inicial
    await supabase
      .from('interactions')
      .insert({
        customer_id: finalContactId,
        type: 'note',
        content: `Conversa pública iniciada via widget de chat (Departamento: ${department.name})`,
        channel: 'other',
        metadata: {
          conversation_id,
          department_id: finalDepartmentId,
          department_name: department.name,
          source: 'public_chat_widget',
          customer_metadata: customerMetadata,
        },
      });

    console.log('[create-public-conversation] Success:', { 
      conversation_id, 
      contact_id: finalContactId,
      is_returning_customer: customerMetadata.is_returning_customer || false,
    });

    // FASE 1: Disparar IA automaticamente para nova conversa (boas-vindas)
    console.log('[create-public-conversation] 🤖 Disparando IA para boas-vindas...');
    try {
      await supabase.functions.invoke('ai-autopilot-chat', {
        body: {
          conversationId: conversation_id,
          customerMessage: '[NOVA_CONVERSA]', // Trigger especial para IA enviar boas-vindas
          customer_context: customerMetadata.is_returning_customer ? {
            name: customer_data?.first_name,
            email: customer_data?.email,
            isVerified: true,
            isReturning: true
          } : null
        },
      });
      console.log('[create-public-conversation] ✅ IA disparada com sucesso');
    } catch (aiError) {
      console.error('[create-public-conversation] ⚠️ Erro ao disparar IA (não-crítico):', aiError);
      // Não falhar a criação da conversa se IA falhar
    }

    return new Response(
      JSON.stringify({
        success: true,
        conversation_id,
        contact_id: finalContactId,
        department_name: department.name,
        is_returning_customer: customerMetadata.is_returning_customer || false,
        session_token: sessionToken, // SECURITY: Return token for session scoping
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
