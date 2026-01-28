import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CRON: Executa a cada hora para extrair conhecimento de conversas fechadas
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[passive-learning-cron] 🎓 Iniciando extração de conhecimento...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se aprendizado passivo está habilitado
    const { data: configData } = await supabase
      .from('system_configurations')
      .select('value')
      .eq('key', 'ai_passive_learning_enabled')
      .maybeSingle();
    
    const isEnabled = configData?.value === 'true';
    
    if (!isEnabled) {
      console.log('[passive-learning-cron] ⏸️ Aprendizado passivo DESABILITADO');
      return new Response(
        JSON.stringify({ success: true, reason: 'disabled', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar conversas fechadas nas últimas 24h que ainda não foram processadas
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: closedConversations, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        contact_id,
        closed_at,
        assigned_to,
        related_ticket_id,
        customer_metadata
      `)
      .eq('status', 'closed')
      .gte('closed_at', twentyFourHoursAgo)
      .is('customer_metadata->passive_learning_processed', null)
      .limit(20); // Processar em batches

    if (convError) {
      console.error('[passive-learning-cron] ❌ Erro ao buscar conversas:', convError);
      throw convError;
    }

    if (!closedConversations || closedConversations.length === 0) {
      console.log('[passive-learning-cron] ✅ Nenhuma conversa nova para processar');
      return new Response(
        JSON.stringify({ success: true, reason: 'no_new_conversations', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[passive-learning-cron] 📝 Processando ${closedConversations.length} conversas...`);

    let extractedCount = 0;
    let skippedCount = 0;

    for (const conversation of closedConversations) {
      try {
        // Chamar função de extração de conhecimento
        const { data: extractResult, error: extractError } = await supabase.functions.invoke('extract-knowledge-from-chat', {
          body: {
            conversationId: conversation.id,
            ticketId: conversation.related_ticket_id
          }
        });

        if (extractError) {
          console.error(`[passive-learning-cron] ❌ Erro ao extrair conhecimento da conversa ${conversation.id}:`, extractError);
          skippedCount++;
        } else if (extractResult?.success) {
          extractedCount++;
          console.log(`[passive-learning-cron] ✅ Conhecimento extraído da conversa ${conversation.id}`);
        } else {
          skippedCount++;
          console.log(`[passive-learning-cron] ⏭️ Conversa ${conversation.id} pulada: ${extractResult?.reason}`);
        }

        // Marcar conversa como processada
        const currentMetadata = conversation.customer_metadata || {};
        await supabase
          .from('conversations')
          .update({
            customer_metadata: {
              ...currentMetadata,
              passive_learning_processed: true,
              passive_learning_processed_at: new Date().toISOString()
            }
          })
          .eq('id', conversation.id);

      } catch (convProcessError) {
        console.error(`[passive-learning-cron] ❌ Erro ao processar conversa ${conversation.id}:`, convProcessError);
        skippedCount++;
      }
    }

    console.log(`[passive-learning-cron] 🎓 Extração concluída: ${extractedCount} extraídos, ${skippedCount} pulados`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: closedConversations.length,
        extracted: extractedCount,
        skipped: skippedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[passive-learning-cron] ❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
