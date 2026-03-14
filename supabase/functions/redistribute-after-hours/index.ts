import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getBusinessHoursInfo } from "../_shared/business-hours.ts";

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

    const bhInfo = await getBusinessHoursInfo(supabaseClient);
    const currentTime = bhInfo.current_time;

    console.log(`[redistribute-after-hours] Dia: ${bhInfo.current_day}, Hora atual (SP): ${currentTime}, Dentro do horário: ${bhInfo.within_hours}, Feriado: ${bhInfo.is_holiday}${bhInfo.holiday_name ? ' (' + bhInfo.holiday_name + ')' : ''}`);

    // Se está FORA do horário comercial, não fazer nada
    if (!bhInfo.within_hours) {
      console.log('[redistribute-after-hours] 🌙 Fora do horário comercial, nenhuma ação necessária');
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Fora do horário comercial - nada a redistribuir',
        currentTime,
        redistributed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DENTRO DO HORÁRIO: Buscar tag configurada ou fallback pendente_retorno
    console.log('[redistribute-after-hours] ☀️ Dentro do horário - buscando conversas com tag after-hours...');

    // 1. Buscar tag configurada na business_messages_config
    let pendenteTagId: string | null = null;
    const { data: configRow } = await supabaseClient
      .from('business_messages_config')
      .select('after_hours_tag_id')
      .eq('message_key', 'after_hours_handoff')
      .maybeSingle();

    if (configRow?.after_hours_tag_id) {
      pendenteTagId = configRow.after_hours_tag_id;
      console.log('[redistribute-after-hours] 🏷️ Usando tag configurada:', pendenteTagId);
    } else {
      // Fallback para pendente_retorno
      const { data: tagRow, error: tagError } = await supabaseClient
        .from('tags')
        .select('id')
        .eq('name', 'pendente_retorno')
        .maybeSingle();

      if (tagError || !tagRow) {
        console.log('[redistribute-after-hours] ⚠️ Nenhuma tag configurada ou fallback encontrada');
        return new Response(JSON.stringify({ 
          status: 'ok', 
          message: 'Nenhuma tag configurada encontrada',
          redistributed: 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      pendenteTagId = tagRow.id;
      console.log('[redistribute-after-hours] 🏷️ Usando tag fallback pendente_retorno:', pendenteTagId);
    }

    // 2. Buscar conversation_tags com essa tag em conversas abertas
    const { data: taggedConversations, error: taggedError } = await supabaseClient
      .from('conversation_tags')
      .select('conversation_id')
      .eq('tag_id', pendenteTagId)
      .limit(50);

    if (taggedError) {
      console.error('[redistribute-after-hours] Erro ao buscar conversation_tags:', taggedError);
      throw taggedError;
    }

    if (!taggedConversations || taggedConversations.length === 0) {
      console.log('[redistribute-after-hours] ✅ Nenhuma conversa com pendente_retorno');
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Nenhuma conversa pendente para redistribuir',
        redistributed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const conversationIds = taggedConversations.map((t: any) => t.conversation_id);
    console.log(`[redistribute-after-hours] Encontradas ${conversationIds.length} conversas com pendente_retorno`);

    // 3. Buscar detalhes das conversas (apenas abertas/pending)
    const { data: conversations, error: convError } = await supabaseClient
      .from('conversations')
      .select('id, customer_metadata, department, contact_id, ai_mode, status')
      .in('id', conversationIds)
      .in('status', ['open', 'pending'])
      .neq('ai_mode', 'waiting_human');

    if (convError) {
      console.error('[redistribute-after-hours] Erro ao buscar conversas:', convError);
      throw convError;
    }

    if (!conversations || conversations.length === 0) {
      console.log('[redistribute-after-hours] ✅ Nenhuma conversa aberta com pendente_retorno');
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Nenhuma conversa aberta com pendente_retorno',
        redistributed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[redistribute-after-hours] ${conversations.length} conversas abertas para redistribuir`);

    let redistributedCount = 0;

    for (const conv of conversations) {
      try {
        const metadata = conv.customer_metadata || {};
        const pendingDeptId = metadata.pending_department_id || conv.department || null;

        // 1. Remover tag PRIMEIRO (anti race-condition)
        await supabaseClient
          .from('conversation_tags')
          .delete()
          .eq('conversation_id', conv.id)
          .eq('tag_id', pendenteTagId);

        // 2. Invocar route-conversation
        const routeBody: any = { conversationId: conv.id };
        if (pendingDeptId) {
          routeBody.departmentId = pendingDeptId;
        }

        const { data: routeResult, error: routeError } = await supabaseClient.functions.invoke('route-conversation', {
          body: routeBody
        });

        if (routeError) {
          console.error(`[redistribute-after-hours] ❌ Erro ao rotear conversa ${conv.id}:`, routeError);
        } else {
          console.log(`[redistribute-after-hours] ✅ Conversa ${conv.id} roteada:`, routeResult);
        }

        // 3. Mudar ai_mode para waiting_human + limpar metadata
        await supabaseClient
          .from('conversations')
          .update({ 
            ai_mode: 'waiting_human',
            customer_metadata: {
              ...metadata,
              after_hours_handoff_requested_at: null,
              after_hours_next_open_text: null,
              pending_department_id: null,
            }
          })
          .eq('id', conv.id);

        // 4. Inserir mensagem de sistema (template configurável com fallback)
        let reopenedMsg = '☀️ Horário comercial iniciado. Um atendente será designado para continuar seu atendimento.';
        try {
          const { data: msgRow } = await supabaseClient
            .from('business_messages_config')
            .select('message_template')
            .eq('message_key', 'business_hours_reopened')
            .maybeSingle();
          if (msgRow?.message_template) {
            reopenedMsg = msgRow.message_template;
          }
        } catch (_) { /* fallback */ }

        await supabaseClient.from('messages').insert({
          conversation_id: conv.id,
          content: reopenedMsg,
          sender_type: 'system',
          channel: 'chat'
        });

        redistributedCount++;
        console.log(`[redistribute-after-hours] ✅ Conversa ${conv.id} redistribuída com sucesso`);
      } catch (convErr) {
        console.error(`[redistribute-after-hours] ❌ Erro ao processar conversa ${conv.id}:`, convErr);
        // Anti-perda: re-add tag para retry na próxima execução do cron
        try {
          await supabaseClient
            .from('conversation_tags')
            .upsert(
              { conversation_id: conv.id, tag_id: pendenteTagId },
              { onConflict: 'conversation_id,tag_id' }
            );
          console.log(`[redistribute-after-hours] 🔄 Tag re-adicionada para ${conv.id} (retry próximo ciclo)`);
        } catch (reAddErr) {
          console.error(`[redistribute-after-hours] ⚠️ CRÍTICO: Falha ao re-add tag para ${conv.id}:`, reAddErr);
        }
      }
    }

    console.log(`[redistribute-after-hours] ✅ Finalizando: ${redistributedCount} conversas redistribuídas`);

    return new Response(JSON.stringify({
      status: 'ok',
      message: 'Redistribuição concluída',
      redistributed: redistributedCount,
      currentTime,
      withinBusinessHours: true
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
