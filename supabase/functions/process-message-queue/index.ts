import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configurações de rate limiting
const MIN_DELAY_ANY_MS = 2000;       // 2 segundos entre qualquer mensagem
const MIN_DELAY_SAME_NUMBER_MS = 3000; // 3 segundos para mesmo número
const BATCH_SIZE = 10;               // Processar até 10 mensagens por execução
const MAX_RETRIES = 3;

interface QueueMessage {
  id: string;
  instance_id: string;
  conversation_id: string | null;
  phone_number: string;
  message: string;
  message_type: string;
  media_url: string | null;
  priority: number;
  status: string;
  scheduled_at: string;
  retry_count: number;
  max_retries: number;
  metadata: Record<string, any>;
  created_at: string;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  api_url: string;
  api_token: string;
  status: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const processedMessages: string[] = [];
  const failedMessages: string[] = [];

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log('[process-message-queue] 🚀 Iniciando processamento da fila...');

    // 1. Buscar mensagens pendentes ordenadas por prioridade e scheduled_at
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('message_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('priority', { ascending: true }) // 1 = mais urgente
      .order('scheduled_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('[process-message-queue] ❌ Erro ao buscar fila:', fetchError);
      throw fetchError;
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('[process-message-queue] ✅ Fila vazia - nada para processar');
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Queue empty',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[process-message-queue] 📦 ${pendingMessages.length} mensagens para processar`);

    // 2. Agrupar por instância para verificar rate limits
    const instanceGroups = new Map<string, QueueMessage[]>();
    for (const msg of pendingMessages) {
      const existing = instanceGroups.get(msg.instance_id) || [];
      existing.push(msg);
      instanceGroups.set(msg.instance_id, existing);
    }

    // 3. Processar cada grupo por instância
    for (const [instanceId, messages] of instanceGroups) {
      // 3.1 Verificar rate limits
      const { data: canSendResult } = await supabase
        .rpc('update_rate_limit_counters', { p_instance_id: instanceId });

      if (!canSendResult?.[0]?.can_send) {
        const waitMs = canSendResult?.[0]?.wait_ms || 60000;
        console.log(`[process-message-queue] ⏳ Instance ${instanceId} rate limited - aguardar ${waitMs}ms`);
        
        // Reagendar mensagens para depois do rate limit
        const rescheduleTime = new Date(Date.now() + waitMs).toISOString();
        await supabase
          .from('message_queue')
          .update({ scheduled_at: rescheduleTime })
          .in('id', messages.map(m => m.id));
        
        continue;
      }

      // 3.2 Buscar dados da instância
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('id', instanceId)
        .single();

      if (!instance || instance.status !== 'connected') {
        console.warn(`[process-message-queue] ⚠️ Instância ${instanceId} não conectada`);
        
        // Marcar como falha temporária e incrementar retry
        for (const msg of messages) {
          await supabase
            .from('message_queue')
            .update({ 
              status: 'failed',
              error_message: 'Instance not connected',
              retry_count: (msg.retry_count || 0) + 1
            })
            .eq('id', msg.id)
            .lt('retry_count', MAX_RETRIES);
        }
        
        continue;
      }

      // 3.3 Processar mensagens uma a uma com delay
      let lastSendTime = 0;
      const lastSendByNumber = new Map<string, number>();

      for (const msg of messages) {
        try {
          // Calcular delay necessário
          const now = Date.now();
          const lastSendToNumber = lastSendByNumber.get(msg.phone_number) || 0;
          
          const delaySinceLastAny = now - lastSendTime;
          const delaySinceLastToNumber = now - lastSendToNumber;
          
          const requiredDelayAny = Math.max(0, MIN_DELAY_ANY_MS - delaySinceLastAny);
          const requiredDelayNumber = Math.max(0, MIN_DELAY_SAME_NUMBER_MS - delaySinceLastToNumber);
          const totalDelay = Math.max(requiredDelayAny, requiredDelayNumber);
          
          if (totalDelay > 0) {
            console.log(`[process-message-queue] ⏱️ Aguardando ${totalDelay}ms antes de enviar...`);
            await new Promise(resolve => setTimeout(resolve, totalDelay));
          }

          // Marcar como processando
          await supabase
            .from('message_queue')
            .update({ status: 'processing' })
            .eq('id', msg.id);

          // Enviar mensagem
          const result = await sendMessageToEvolution(instance, msg);

          if (result.success) {
            // Sucesso - marcar como enviada
            await supabase
              .from('message_queue')
              .update({ 
                status: 'sent',
                sent_at: new Date().toISOString()
              })
              .eq('id', msg.id);

            // Incrementar contadores de rate limit
            await supabase.rpc('increment_rate_limit_counters', { p_instance_id: instanceId });

            lastSendTime = Date.now();
            lastSendByNumber.set(msg.phone_number, Date.now());
            processedMessages.push(msg.id);

            console.log(`[process-message-queue] ✅ Mensagem ${msg.id} enviada com sucesso`);
          } else {
            throw new Error(result.error || 'Unknown send error');
          }

        } catch (sendError) {
          const errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';
          console.error(`[process-message-queue] ❌ Erro ao enviar ${msg.id}:`, errorMessage);

          // Incrementar retry ou marcar como falha
          const newRetryCount = (msg.retry_count || 0) + 1;
          
          if (newRetryCount >= MAX_RETRIES) {
            await supabase
              .from('message_queue')
              .update({ 
                status: 'failed',
                error_message: errorMessage,
                retry_count: newRetryCount
              })
              .eq('id', msg.id);
            
            failedMessages.push(msg.id);
          } else {
            // Reagendar com backoff exponencial
            const backoffMs = Math.pow(2, newRetryCount) * 1000; // 2s, 4s, 8s...
            const retryAt = new Date(Date.now() + backoffMs).toISOString();
            
            await supabase
              .from('message_queue')
              .update({ 
                status: 'pending',
                error_message: errorMessage,
                retry_count: newRetryCount,
                scheduled_at: retryAt
              })
              .eq('id', msg.id);
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[process-message-queue] 🏁 Processamento concluído em ${duration}ms`);
    console.log(`[process-message-queue] ✅ Enviadas: ${processedMessages.length}, ❌ Falhas: ${failedMessages.length}`);

    return new Response(JSON.stringify({
      status: 'ok',
      processed: processedMessages.length,
      failed: failedMessages.length,
      duration_ms: duration,
      processed_ids: processedMessages,
      failed_ids: failedMessages
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[process-message-queue] 🔥 Erro geral:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      processed: processedMessages.length,
      failed: failedMessages.length
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Helper: Enviar mensagem via Evolution API
async function sendMessageToEvolution(
  instance: WhatsAppInstance, 
  msg: QueueMessage
): Promise<{ success: boolean; error?: string; data?: any }> {
  
  const baseUrl = instance.api_url.replace(/\/manager$/, '').replace(/\/$/, '');
  const evolutionUrl = `${baseUrl}/message/sendText/${instance.instance_name}`;
  
  console.log(`[sendMessageToEvolution] 📤 Enviando para ${msg.phone_number}...`);

  try {
    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'apikey': instance.api_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: msg.phone_number,
        text: msg.message,
        delay: 1200,
        linkPreview: false
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { 
        success: false, 
        error: `Evolution API error: ${response.status} - ${JSON.stringify(data)}`,
        data 
      };
    }

    return { success: true, data };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error';
    return { success: false, error: errorMessage };
  }
}
