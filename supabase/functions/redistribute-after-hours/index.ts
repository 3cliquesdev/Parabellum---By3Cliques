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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[redistribute-after-hours] Verificando horário comercial...');

    // Buscar configuração de horário comercial
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Segunda, etc.
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false,
      timeZone: 'America/Sao_Paulo' 
    });

    console.log(`[redistribute-after-hours] Dia: ${dayOfWeek}, Hora atual (SP): ${currentTime}`);

    // Buscar configuração do dia atual
    const { data: businessHours, error: bhError } = await supabaseClient
      .from('business_hours_config')
      .select('*')
      .eq('day_of_week', dayOfWeek)
      .single();

    if (bhError) {
      console.log('[redistribute-after-hours] Erro ao buscar horário:', bhError);
      // Se não encontrar config, considerar fora do horário
    }

    // Verificar se está fora do horário comercial
    let isOutsideBusinessHours = false;
    
    if (!businessHours || !businessHours.is_working_day) {
      isOutsideBusinessHours = true;
      console.log('[redistribute-after-hours] Não é dia útil');
    } else {
      const startTime = businessHours.start_time; // ex: "08:00"
      const endTime = businessHours.end_time; // ex: "17:00"
      
      if (currentTime < startTime || currentTime >= endTime) {
        isOutsideBusinessHours = true;
        console.log(`[redistribute-after-hours] Fora do horário: ${currentTime} não está entre ${startTime} e ${endTime}`);
      }
    }

    // Se está dentro do horário comercial, não fazer nada
    if (!isOutsideBusinessHours) {
      console.log('[redistribute-after-hours] ✅ Dentro do horário comercial, nenhuma ação necessária');
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Dentro do horário comercial',
        currentTime,
        redistributed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // FORA DO HORÁRIO: Buscar conversas abertas com agente atribuído
    console.log('[redistribute-after-hours] 🌙 Fora do horário - redistribuindo conversas para pool geral...');

    // Only redistribute conversations that were NOT manually assumed by agents
    // 'copilot' and 'disabled' modes indicate agent manually took control
    const { data: activeConversations, error: convError } = await supabaseClient
      .from('conversations')
      .select('id, assigned_to, ai_mode, contact_id')
      .in('status', ['open', 'pending'])
      .not('assigned_to', 'is', null)
      .neq('ai_mode', 'copilot')   // Preserve copilot (agent assumed)
      .neq('ai_mode', 'disabled'); // Preserve disabled (agent disabled AI)

    if (convError) {
      console.error('[redistribute-after-hours] Erro ao buscar conversas:', convError);
      throw convError;
    }

    console.log(`[redistribute-after-hours] Encontradas ${activeConversations?.length || 0} conversas com agentes atribuídos`);

    if (!activeConversations || activeConversations.length === 0) {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Nenhuma conversa para redistribuir',
        redistributed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Redistribuir cada conversa para o pool geral
    let redistributedCount = 0;

    for (const conv of activeConversations) {
      // Guardar agente anterior e limpar atribuição
      const { error: updateError } = await supabaseClient
        .from('conversations')
        .update({
          previous_agent_id: conv.assigned_to,
          assigned_to: null,
          ai_mode: 'autopilot' // IA assume temporariamente
        })
        .eq('id', conv.id);

      if (updateError) {
        console.error(`[redistribute-after-hours] Erro ao atualizar conversa ${conv.id}:`, updateError);
        continue;
      }

      // Inserir mensagem de sistema
      await supabaseClient.from('messages').insert({
        conversation_id: conv.id,
        content: '🌙 Estamos fora do horário de atendimento humano. A IA está disponível para ajudar até o próximo expediente.',
        sender_type: 'system',
        channel: 'chat' // Corrigido: usar valor válido do enum conversation_channel
      });

      // Adicionar à fila de espera
      await supabaseClient.from('conversation_queue').upsert({
        conversation_id: conv.id,
        priority: 0,
        queued_at: new Date().toISOString()
      }, { onConflict: 'conversation_id' });

      redistributedCount++;
      console.log(`[redistribute-after-hours] ✅ Conversa ${conv.id} movida para pool geral`);
    }

    console.log(`[redistribute-after-hours] ✅ Finalizando: ${redistributedCount} conversas redistribuídas`);

    return new Response(JSON.stringify({
      status: 'ok',
      message: 'Redistribuição concluída',
      redistributed: redistributedCount,
      currentTime,
      isOutsideBusinessHours: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[redistribute-after-hours] Erro geral:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
