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

// Mensagem de CSAT
const CSAT_MESSAGE = `📊 *Avalie nosso atendimento!*

Por favor, avalie de 1 a 5 estrelas:

⭐ 1 - Péssimo
⭐⭐ 2 - Ruim
⭐⭐⭐ 3 - Regular
⭐⭐⭐⭐ 4 - Bom
⭐⭐⭐⭐⭐ 5 - Excelente

Responda apenas com o número da sua avaliação.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    console.log('[Auto-Close] Starting inactivity check - 30 minute threshold (excluding comercial)...');

    // Buscar conversas abertas onde a IA respondeu e o cliente não respondeu há mais de 30 minutos
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Buscar departamentos comerciais para excluir do auto-close
    const { data: comercialDepts } = await supabase
      .from('departments')
      .select('id')
      .ilike('name', '%comercial%');
    
    const comercialDeptIds = comercialDepts?.map(d => d.id) || [];
    console.log(`[Auto-Close] Excluding ${comercialDeptIds.length} comercial departments from auto-close`);

    // Buscar conversas em modo autopilot/copilot que estão inativas (exceto comercial)
    let query = supabase
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
      .in('ai_mode', ['autopilot', 'copilot'])
      .lt('last_message_at', thirtyMinutesAgo);

    // Excluir departamentos comerciais do auto-close
    if (comercialDeptIds.length > 0) {
      query = query.not('department', 'in', `(${comercialDeptIds.join(',')})`);
    }

    const { data: conversations, error: fetchError } = await query;

    if (fetchError) {
      console.error('[Auto-Close] Error fetching conversations:', fetchError);
      throw fetchError;
    }

    console.log(`[Auto-Close] Found ${conversations?.length || 0} potentially inactive conversations`);

    if (!conversations || conversations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, closed_count: 0, message: 'No inactive conversations found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let closedCount = 0;
    const closedIds: string[] = [];

    for (const conversation of conversations) {
      try {
        // Verificar se a última mensagem foi da IA (user/system) e não do cliente
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

        console.log(`[Auto-Close] Processing conversation ${conversation.id}...`);

        // 1. Enviar mensagem de encerramento
        await supabase
          .from('messages')
          .insert({
            conversation_id: conversation.id,
            content: INACTIVITY_CLOSE_MESSAGE,
            sender_type: 'user', // IA enviando
          });

        // 2. Adicionar a tag "9.04 Desistência da conversa"
        await supabase
          .from('conversation_tags')
          .upsert({
            conversation_id: conversation.id,
            tag_id: DESISTENCIA_TAG_ID,
          }, {
            onConflict: 'conversation_id,tag_id',
            ignoreDuplicates: true
          });

        // 3. Fechar a conversa
        await supabase
          .from('conversations')
          .update({
            status: 'closed',
            auto_closed: true,
            closed_at: new Date().toISOString(),
            ai_mode: 'disabled',
            awaiting_rating: true,
            rating_sent_at: new Date().toISOString(),
          })
          .eq('id', conversation.id);

        // 4. Enviar mensagem de CSAT
        await supabase
          .from('messages')
          .insert({
            conversation_id: conversation.id,
            content: CSAT_MESSAGE,
            sender_type: 'user',
          });

        // 5. Enviar via WhatsApp se for canal WhatsApp
        if (conversation.channel === 'whatsapp') {
          // Buscar telefone do contato
          const { data: contact } = await supabase
            .from('contacts')
            .select('phone, whatsapp_id')
            .eq('id', conversation.contact_id)
            .single();

          if (contact?.phone || contact?.whatsapp_id) {
            const phoneNumber = contact.whatsapp_id || contact.phone?.replace(/\D/g, '');
            
            // Enviar mensagem de encerramento via WhatsApp
            try {
              if (conversation.whatsapp_provider === 'meta' && conversation.whatsapp_meta_instance_id) {
                await supabase.functions.invoke('send-meta-whatsapp', {
                  body: {
                    instanceId: conversation.whatsapp_meta_instance_id,
                    to: phoneNumber,
                    message: INACTIVITY_CLOSE_MESSAGE,
                  }
                });
                
                // Enviar CSAT
                await supabase.functions.invoke('send-meta-whatsapp', {
                  body: {
                    instanceId: conversation.whatsapp_meta_instance_id,
                    to: phoneNumber,
                    message: CSAT_MESSAGE,
                  }
                });
              } else if (conversation.whatsapp_instance_id) {
                await supabase.functions.invoke('send-whatsapp', {
                  body: {
                    instanceId: conversation.whatsapp_instance_id,
                    to: phoneNumber,
                    message: INACTIVITY_CLOSE_MESSAGE,
                  }
                });
                
                // Enviar CSAT
                await supabase.functions.invoke('send-whatsapp', {
                  body: {
                    instanceId: conversation.whatsapp_instance_id,
                    to: phoneNumber,
                    message: CSAT_MESSAGE,
                  }
                });
              }
            } catch (whatsappError) {
              console.error(`[Auto-Close] WhatsApp send error for ${conversation.id}:`, whatsappError);
            }
          }
        }

        closedCount++;
        closedIds.push(conversation.id);
        console.log(`[Auto-Close] ✅ Closed conversation ${conversation.id} with tag and CSAT`);
      } catch (err) {
        console.error(`[Auto-Close] Error closing conversation ${conversation.id}:`, err);
      }
    }

    console.log(`[Auto-Close] ✅ Complete - closed ${closedCount} conversations`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        closed_count: closedCount,
        closed_ids: closedIds,
        message: `Closed ${closedCount} inactive conversations with tag "9.04 Desistência da conversa" and CSAT sent` 
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
