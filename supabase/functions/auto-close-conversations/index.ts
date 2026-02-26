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
  ai_auto_close_minutes: number | null;
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

    console.log('[Auto-Close] Starting...');

    // ============================
    // ETAPA 1: WhatsApp Window Expired (>24h)
    // ============================
    let windowExpiredCount = 0;
    try {
      const threshold24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: expiredConvos, error: expiredError } = await supabase
        .from('conversations')
        .select('id, contact_id')
        .eq('status', 'open')
        .eq('channel', 'whatsapp')
        .lt('last_message_at', threshold24h);

      if (expiredError) {
        console.error('[Auto-Close] Error fetching expired WhatsApp convos:', expiredError);
      } else if (expiredConvos && expiredConvos.length > 0) {
        console.log(`[Auto-Close] Found ${expiredConvos.length} WhatsApp conversations with expired 24h window`);

        for (const conv of expiredConvos) {
          try {
            // Close silently - no WhatsApp message (window expired)
            await supabase
              .from('conversations')
              .update({
                status: 'closed',
                auto_closed: true,
                closed_at: new Date().toISOString(),
                closed_reason: 'whatsapp_window_expired',
                ai_mode: 'disabled',
              })
              .eq('id', conv.id);

            // Internal message only (not sent to WhatsApp)
            await supabase
              .from('messages')
              .insert({
                conversation_id: conv.id,
                content: 'Conversa encerrada automaticamente - janela de 24h do WhatsApp expirada.',
                sender_type: 'system',
              });

            // Add "Desistência" tag
            await supabase
              .from('conversation_tags')
              .upsert({
                conversation_id: conv.id,
                tag_id: DESISTENCIA_TAG_ID,
              }, {
                onConflict: 'conversation_id,tag_id',
                ignoreDuplicates: true,
              });

            windowExpiredCount++;
            console.log(`[Auto-Close] ✅ Closed expired WhatsApp conversation ${conv.id}`);
          } catch (err) {
            console.error(`[Auto-Close] Error closing expired conversation ${conv.id}:`, err);
          }
        }
      } else {
        console.log('[Auto-Close] No WhatsApp conversations with expired 24h window');
      }
    } catch (err) {
      console.error('[Auto-Close] Error in WhatsApp window expired step:', err);
    }

    console.log(`[Auto-Close] WhatsApp window expired step: closed ${windowExpiredCount} conversations`);

    // ============================
    // ETAPA 2: Auto-close por departamento (inatividade configurada)
    // ============================
    console.log('[Auto-Close] Starting department-based inactivity check...');

    // 1. Buscar departamentos com auto_close_enabled = true
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('id, name, auto_close_enabled, auto_close_minutes, send_rating_on_close, ai_auto_close_minutes')
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
        .eq('ai_mode', 'autopilot')
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

          // 7. Enviar CSAT ANTES de fechar (se configurado)
          if (dept.send_rating_on_close) {
            await supabase
              .from('messages')
              .insert({
                conversation_id: conversation.id,
                content: CSAT_MESSAGE,
                sender_type: 'user',
              });

            // Enviar via WhatsApp se for canal WhatsApp
            if (conversation.channel === 'whatsapp') {
              await sendWhatsAppMessages(supabase, conversation, INACTIVITY_CLOSE_MESSAGE, CSAT_MESSAGE);
            }
          } else if (conversation.channel === 'whatsapp') {
            // Enviar apenas mensagem de encerramento se não envia CSAT
            await sendWhatsAppMessages(supabase, conversation, INACTIVITY_CLOSE_MESSAGE, null);
          }

          // 8. AGORA fechar a conversa (DEPOIS do CSAT)
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

    console.log(`[Auto-Close] ✅ Stage 2 complete - closed ${totalClosedCount} conversations`);
    console.log('[Auto-Close] Results by department:', JSON.stringify(results));

    // ============================
    // ETAPA 3: AI inactivity auto-close (ai_auto_close_minutes por departamento)
    // ============================
    console.log('[Auto-Close] Starting AI inactivity check (Stage 3)...');

    let aiClosedCount = 0;

    // Buscar departamentos com ai_auto_close_minutes configurado
    const { data: aiDepartments, error: aiDeptError } = await supabase
      .from('departments')
      .select('id, name, ai_auto_close_minutes, send_rating_on_close')
      .not('ai_auto_close_minutes', 'is', null);

    if (aiDeptError) {
      console.error('[Auto-Close] Error fetching AI departments:', aiDeptError);
    } else if (aiDepartments && aiDepartments.length > 0) {
      console.log(`[Auto-Close] Found ${aiDepartments.length} departments with AI auto-close configured`);

      for (const dept of aiDepartments) {
        const aiThreshold = new Date(Date.now() - dept.ai_auto_close_minutes! * 60 * 1000).toISOString();
        console.log(`[Auto-Close] AI check for "${dept.name}" - threshold: ${dept.ai_auto_close_minutes} min`);

        const { data: aiConvos, error: aiConvError } = await supabase
          .from('conversations')
          .select('id, contact_id, last_message_at, ai_mode, channel, department, whatsapp_instance_id, whatsapp_meta_instance_id, whatsapp_provider')
          .eq('status', 'open')
          .eq('department', dept.id)
          .eq('ai_mode', 'autopilot')
          .lt('last_message_at', aiThreshold);

        if (aiConvError) {
          console.error(`[Auto-Close] Error fetching AI conversations for ${dept.name}:`, aiConvError);
          continue;
        }

        if (!aiConvos || aiConvos.length === 0) {
          console.log(`[Auto-Close] No AI inactive conversations in "${dept.name}"`);
          continue;
        }

        for (const conv of aiConvos as ConversationToClose[]) {
          // Pular se já foi fechado nas etapas anteriores
          if (closedIds.includes(conv.id)) continue;

          try {
            // Verificar última mensagem - só fechar se IA/sistema respondeu e cliente não
            const { data: lastMsg } = await supabase
              .from('messages')
              .select('sender_type')
              .eq('conversation_id', conv.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (!lastMsg || lastMsg.sender_type === 'contact') {
              console.log(`[Auto-Close] AI skip ${conv.id} - last msg from contact`);
              continue;
            }

            const AI_CLOSE_MESSAGE = `Não recebi sua resposta nos últimos minutos, então estou encerrando este atendimento para liberar o canal. 😊

Se precisar de ajuda, basta enviar uma nova mensagem a qualquer momento!`;

            // Inserir mensagem de encerramento
            await supabase.from('messages').insert({
              conversation_id: conv.id,
              content: AI_CLOSE_MESSAGE,
              sender_type: 'user',
            });

            // Tag "Desistência"
            await supabase.from('conversation_tags').upsert({
              conversation_id: conv.id,
              tag_id: DESISTENCIA_TAG_ID,
            }, { onConflict: 'conversation_id,tag_id', ignoreDuplicates: true });

            // CSAT se configurado
            if (dept.send_rating_on_close) {
              await supabase.from('messages').insert({
                conversation_id: conv.id,
                content: CSAT_MESSAGE,
                sender_type: 'user',
              });

              if (conv.channel === 'whatsapp') {
                await sendWhatsAppMessages(supabase, conv, AI_CLOSE_MESSAGE, CSAT_MESSAGE);
              }
            } else if (conv.channel === 'whatsapp') {
              await sendWhatsAppMessages(supabase, conv, AI_CLOSE_MESSAGE, null);
            }

            // Fechar conversa
            const closeData: Record<string, unknown> = {
              status: 'closed',
              auto_closed: true,
              closed_at: new Date().toISOString(),
              closed_reason: 'ai_inactivity',
              ai_mode: 'disabled',
            };

            if (dept.send_rating_on_close) {
              closeData.awaiting_rating = true;
              closeData.rating_sent_at = new Date().toISOString();
            }

            await supabase.from('conversations').update(closeData).eq('id', conv.id);

            aiClosedCount++;
            closedIds.push(conv.id);
            console.log(`[Auto-Close] ✅ AI closed conversation ${conv.id} (${dept.name}) - ai_inactivity`);
          } catch (err) {
            console.error(`[Auto-Close] Error AI-closing ${conv.id}:`, err);
          }
        }
      }
    } else {
      console.log('[Auto-Close] No departments with AI auto-close configured');
    }

    console.log(`[Auto-Close] ✅ Stage 3 complete - AI closed ${aiClosedCount} conversations`);

    // ============================
    // ETAPA 3b: AI inactivity para conversas SEM departamento (fallback 5 min)
    // ============================
    console.log('[Auto-Close] Starting no-department AI inactivity check (Stage 3b)...');

    let noDeptClosedCount = 0;
    const noDeptThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    try {
      const { data: noDeptConvos, error: noDeptError } = await supabase
        .from('conversations')
        .select('id, contact_id, last_message_at, ai_mode, channel, department, whatsapp_instance_id, whatsapp_meta_instance_id, whatsapp_provider')
        .eq('status', 'open')
        .eq('ai_mode', 'autopilot')
        .is('department', null)
        .lt('last_message_at', noDeptThreshold);

      if (noDeptError) {
        console.error('[Auto-Close] Error fetching no-dept conversations:', noDeptError);
      } else if (noDeptConvos && noDeptConvos.length > 0) {
        console.log(`[Auto-Close] Found ${noDeptConvos.length} no-department AI conversations inactive >5min`);

        for (const conv of noDeptConvos as ConversationToClose[]) {
          if (closedIds.includes(conv.id)) continue;

          try {
            // Verificar última mensagem - só fechar se IA/sistema respondeu e cliente não
            const { data: lastMsg } = await supabase
              .from('messages')
              .select('sender_type')
              .eq('conversation_id', conv.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (!lastMsg || lastMsg.sender_type === 'contact') {
              console.log(`[Auto-Close] No-dept skip ${conv.id} - last msg from contact`);
              continue;
            }

            const AI_CLOSE_MESSAGE = `Não recebi sua resposta nos últimos minutos, então estou encerrando este atendimento para liberar o canal. 😊

Se precisar de ajuda, basta enviar uma nova mensagem a qualquer momento!`;

            // Inserir mensagem de encerramento
            await supabase.from('messages').insert({
              conversation_id: conv.id,
              content: AI_CLOSE_MESSAGE,
              sender_type: 'user',
            });

            // Tag "Desistência"
            await supabase.from('conversation_tags').upsert({
              conversation_id: conv.id,
              tag_id: DESISTENCIA_TAG_ID,
            }, { onConflict: 'conversation_id,tag_id', ignoreDuplicates: true });

            // Enviar via WhatsApp se necessário (sem CSAT - não há departamento)
            if (conv.channel === 'whatsapp') {
              await sendWhatsAppMessages(supabase, conv, AI_CLOSE_MESSAGE, null);
            }

            // Fechar conversa (sem CSAT - sem departamento para consultar config)
            await supabase.from('conversations').update({
              status: 'closed',
              auto_closed: true,
              closed_at: new Date().toISOString(),
              closed_reason: 'ai_inactivity',
              ai_mode: 'disabled',
            }).eq('id', conv.id);

            noDeptClosedCount++;
            closedIds.push(conv.id);
            console.log(`[Auto-Close] ✅ No-dept AI closed conversation ${conv.id} - ai_inactivity (no department)`);
          } catch (err) {
            console.error(`[Auto-Close] Error closing no-dept conversation ${conv.id}:`, err);
          }
        }
      } else {
        console.log('[Auto-Close] No no-department AI conversations to close');
      }
    } catch (err) {
      console.error('[Auto-Close] Error in no-department AI step:', err);
    }

    console.log(`[Auto-Close] ✅ Stage 3b complete - no-dept AI closed ${noDeptClosedCount} conversations`);
    console.log(`[Auto-Close] ✅ All stages complete - total: ${totalClosedCount + aiClosedCount + noDeptClosedCount} inactivity + ${windowExpiredCount} expired`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        closed_count: totalClosedCount + aiClosedCount + noDeptClosedCount,
        whatsapp_window_expired_count: windowExpiredCount,
        ai_inactivity_closed_count: aiClosedCount,
        no_dept_closed_count: noDeptClosedCount,
        closed_ids: closedIds,
        by_department: results,
        message: `Closed ${totalClosedCount} by inactivity + ${aiClosedCount} by AI inactivity + ${noDeptClosedCount} no-dept AI + ${windowExpiredCount} by WhatsApp window expired` 
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
          is_bot_message: true,
        }
      });
      
      if (csatMessage) {
        await supabase.functions.invoke('send-meta-whatsapp', {
          body: {
            instanceId: conversation.whatsapp_meta_instance_id,
            to: phoneNumber,
            message: csatMessage,
            is_bot_message: true,
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
          is_bot_message: true,
        }
      });
      
      if (csatMessage) {
        await supabase.functions.invoke('send-whatsapp', {
          body: {
            instanceId: conversation.whatsapp_instance_id,
            to: phoneNumber,
            message: csatMessage,
            is_bot_message: true,
          }
        });
      }
    }
  } catch (whatsappError) {
    console.error(`[Auto-Close] WhatsApp send error for ${conversation.id}:`, whatsappError);
  }
}
