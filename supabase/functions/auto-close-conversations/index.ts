import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tag ID para "9.04 Desistência da conversa"
const DESISTENCIA_TAG_ID = 'aa44b48d-c8bf-4def-ac9f-4caa8d9bfea9';

// Mensagem de encerramento por inatividade
const INACTIVITY_CLOSE_MESSAGE = `Sinto que não recebi resposta nesta conversa.

Como não houve interação recente, estou encerrando o atendimento para liberar o canal.

Caso precise de ajuda com pedidos, saldo ou qualquer dúvida, basta iniciar um novo chat – estarei à disposição para resolver com prioridade.`;

// Mensagem de CSAT simplificada
const CSAT_MESSAGE = `📝 Antes de encerrar, pode avaliar nosso atendimento?

⭐ 1 - Muito ruim
⭐ 2 - Ruim
⭐ 3 - Regular
⭐ 4 - Bom
⭐ 5 - Excelente

Responda apenas com o número.`;

interface DepartmentConfig {
  id: string;
  name: string;
  auto_close_enabled: boolean;
  auto_close_minutes: number | null;
  send_rating_on_close: boolean;
}

interface ConversationToClose {
  id: string;
  contact_id: string;
  last_message_at: string;
  ai_mode: string;
  channel: string;
  department: string | null;
  whatsapp_instance_id: string | null;
  whatsapp_meta_instance_id: string | null;
  whatsapp_provider: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    console.log('[Auto-Close] Starting dynamic inactivity check based on department settings...');

    // 1. Buscar departamentos com auto_close_enabled = true
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('id, name, auto_close_enabled, auto_close_minutes, send_rating_on_close')
      .eq('auto_close_enabled', true)
      .not('auto_close_minutes', 'is', null);

    if (deptError) {
      console.error('[Auto-Close] Error fetching departments:', deptError);
      throw deptError;
    }

    if (!departments || departments.length === 0) {
      console.log('[Auto-Close] No departments with auto_close_enabled found');
      return new Response(
        JSON.stringify({ success: true, closed_count: 0, message: 'No auto-close departments configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Auto-Close] Found ${departments.length} departments with auto-close enabled:`);
    departments.forEach((dept: DepartmentConfig) => {
      console.log(`  - ${dept.name}: ${dept.auto_close_minutes} min, CSAT: ${dept.send_rating_on_close}`);
    });

    let totalClosedCount = 0;
    const closedIds: string[] = [];
    const results: { department: string; closed: number }[] = [];

    // 2. Processar cada departamento com sua configuração específica
    for (const dept of departments as DepartmentConfig[]) {
      if (!dept.auto_close_minutes) continue;

      const inactivityThreshold = new Date(Date.now() - dept.auto_close_minutes * 60 * 1000).toISOString();
      
      console.log(`[Auto-Close] Processing department "${dept.name}" - threshold: ${dept.auto_close_minutes} min`);

      // 3. Buscar conversas abertas deste departamento que estão inativas
      const { data: conversations, error: fetchError } = await supabase
        .from('conversations')
        .select(`
          id, 
          contact_id, 
          last_message_at,
          ai_mode,
          channel,
          department,
          whatsapp_instance_id,
          whatsapp_meta_instance_id,
          whatsapp_provider
        `)
        .eq('status', 'open')
        .eq('department', dept.id)
        .in('ai_mode', ['autopilot', 'copilot'])
        .lt('last_message_at', inactivityThreshold);

      if (fetchError) {
        console.error(`[Auto-Close] Error fetching conversations for ${dept.name}:`, fetchError);
        continue;
      }

      console.log(`[Auto-Close] Found ${conversations?.length || 0} potentially inactive conversations in "${dept.name}"`);

      if (!conversations || conversations.length === 0) {
        results.push({ department: dept.name, closed: 0 });
        continue;
      }

      let deptClosedCount = 0;

      for (const conversation of conversations as ConversationToClose[]) {
        try {
          // 4. Verificar se a última mensagem foi da IA (user/system) e não do cliente
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('sender_type, created_at')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Só fechar se a última mensagem foi da IA/sistema (cliente não respondeu)
          if (!lastMessage || lastMessage.sender_type === 'contact') {
            console.log(`[Auto-Close] Skipping ${conversation.id} - last message was from contact or no messages`);
            continue;
          }

          console.log(`[Auto-Close] Processing conversation ${conversation.id} in "${dept.name}"...`);

          // 5. Enviar mensagem de encerramento
          await supabase
            .from('messages')
            .insert({
              conversation_id: conversation.id,
              content: INACTIVITY_CLOSE_MESSAGE,
              sender_type: 'user',
            });

          // 6. Adicionar a tag "9.04 Desistência da conversa"
          await supabase
            .from('conversation_tags')
            .upsert({
              conversation_id: conversation.id,
              tag_id: DESISTENCIA_TAG_ID,
            }, {
              onConflict: 'conversation_id,tag_id',
              ignoreDuplicates: true
            });

          // 7. Fechar a conversa com closed_reason = 'inactivity'
          const updateData: Record<string, unknown> = {
            status: 'closed',
            auto_closed: true,
            closed_at: new Date().toISOString(),
            closed_reason: 'inactivity',
            ai_mode: 'disabled',
          };

          // Se send_rating_on_close = true, marcar para aguardar avaliação
          if (dept.send_rating_on_close) {
            updateData.awaiting_rating = true;
            updateData.rating_sent_at = new Date().toISOString();
          }

          await supabase
            .from('conversations')
            .update(updateData)
            .eq('id', conversation.id);

          // 8. Enviar CSAT se configurado
          if (dept.send_rating_on_close) {
            await supabase
              .from('messages')
              .insert({
                conversation_id: conversation.id,
                content: CSAT_MESSAGE,
                sender_type: 'user',
              });

            // 9. Enviar via WhatsApp se for canal WhatsApp
            if (conversation.channel === 'whatsapp') {
              await sendWhatsAppMessages(supabase, conversation, INACTIVITY_CLOSE_MESSAGE, CSAT_MESSAGE);
            }
          } else if (conversation.channel === 'whatsapp') {
            // Enviar apenas mensagem de encerramento se não envia CSAT
            await sendWhatsAppMessages(supabase, conversation, INACTIVITY_CLOSE_MESSAGE, null);
          }

          deptClosedCount++;
          totalClosedCount++;
          closedIds.push(conversation.id);
          console.log(`[Auto-Close] ✅ Closed conversation ${conversation.id} (${dept.name}) - closed_reason: inactivity`);
        } catch (err) {
          console.error(`[Auto-Close] Error closing conversation ${conversation.id}:`, err);
        }
      }

      results.push({ department: dept.name, closed: deptClosedCount });
    }

    console.log(`[Auto-Close] ✅ Complete - closed ${totalClosedCount} conversations total`);
    console.log('[Auto-Close] Results by department:', JSON.stringify(results));

    return new Response(
      JSON.stringify({ 
        success: true, 
        closed_count: totalClosedCount,
        closed_ids: closedIds,
        by_department: results,
        message: `Closed ${totalClosedCount} inactive conversations based on department settings` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Auto-Close] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Função auxiliar para enviar mensagens via WhatsApp
async function sendWhatsAppMessages(
  supabase: any, 
  conversation: ConversationToClose, 
  closeMessage: string, 
  csatMessage: string | null
) {
  try {
    // Buscar telefone do contato
    const { data: contact } = await supabase
      .from('contacts')
      .select('phone, whatsapp_id')
      .eq('id', conversation.contact_id)
      .single();

    if (!contact?.phone && !contact?.whatsapp_id) {
      console.log(`[Auto-Close] No phone found for contact ${conversation.contact_id}`);
      return;
    }

    const phoneNumber = contact.whatsapp_id || contact.phone?.replace(/\D/g, '');

    // Determinar qual API usar e enviar mensagens
    if (conversation.whatsapp_provider === 'meta' && conversation.whatsapp_meta_instance_id) {
      // Meta WhatsApp API
      await supabase.functions.invoke('send-meta-whatsapp', {
        body: {
          instanceId: conversation.whatsapp_meta_instance_id,
          to: phoneNumber,
          message: closeMessage,
        }
      });
      
      if (csatMessage) {
        await supabase.functions.invoke('send-meta-whatsapp', {
          body: {
            instanceId: conversation.whatsapp_meta_instance_id,
            to: phoneNumber,
            message: csatMessage,
          }
        });
      }
    } else if (conversation.whatsapp_instance_id) {
      // Evolution API
      await supabase.functions.invoke('send-whatsapp', {
        body: {
          instanceId: conversation.whatsapp_instance_id,
          to: phoneNumber,
          message: closeMessage,
        }
      });
      
      if (csatMessage) {
        await supabase.functions.invoke('send-whatsapp', {
          body: {
            instanceId: conversation.whatsapp_instance_id,
            to: phoneNumber,
            message: csatMessage,
          }
        });
      }
    }
  } catch (whatsappError) {
    console.error(`[Auto-Close] WhatsApp send error for ${conversation.id}:`, whatsappError);
  }
}
