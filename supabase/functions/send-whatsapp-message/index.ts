import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendWhatsAppRequest {
  instance_id: string;
  phone_number?: string;   // Fallback (pode ser nulo)
  whatsapp_id?: string;    // ✅ PRIORIDADE - JID original (@lid, @s.whatsapp.net)
  message: string;
  delay?: number;
  conversation_id?: string; // Para vincular à conversa na fila
  priority?: number;       // 1-10 (1 = urgente, default = 5)
  use_queue?: boolean;     // Se true, usa fila. Default = true para rate limiting
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { persistSession: false },
      }
    );

    const body: SendWhatsAppRequest = await req.json();
    console.log('[send-whatsapp-message] Request:', {
      instance_id: body.instance_id,
      phone: body.phone_number,
      whatsapp_id: body.whatsapp_id,
      delay: body.delay,
    });

    // Validação básica
    if (!body.instance_id || (!body.phone_number && !body.whatsapp_id) || !body.message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields (instance_id, phone_number or whatsapp_id, message)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🆕 FASE 6: Usar fila para rate limiting (default = true)
    const useQueue = body.use_queue !== false;
    
    // Buscar instância
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('id', body.instance_id)
      .single();

    if (instanceError || !instance) {
      console.error('[send-whatsapp-message] Instance not found:', body.instance_id);
      return new Response(
        JSON.stringify({ error: 'Instance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🆕 FASE 6: Sanitizar número para a fila
    function sanitizePhoneNumberForQueue(phone?: string, whatsappId?: string): string {
      // Se whatsapp_id for @s.whatsapp.net ou @c.us (número normal), extrair dígitos
      if (whatsappId && !whatsappId.endsWith('@lid')) {
        const digitsOnly = whatsappId.replace(/\D/g, '');
        if (digitsOnly.length === 10 || digitsOnly.length === 11) {
          return digitsOnly.startsWith('55') ? digitsOnly : `55${digitsOnly}`;
        }
        return digitsOnly;
      }
      
      // Se for LID (@lid), usar phone_number como fallback
      if (whatsappId && whatsappId.endsWith('@lid') && phone) {
        const sanitized = phone.replace(/\D/g, '');
        if (sanitized.length === 10 || sanitized.length === 11) {
          return sanitized.startsWith('55') ? sanitized : `55${sanitized}`;
        }
        return sanitized;
      }
      
      // FALLBACK FINAL: phone_number apenas
      if (phone) {
        const sanitized = phone.replace(/\D/g, '');
        if (sanitized.length === 10 || sanitized.length === 11) {
          return sanitized.startsWith('55') ? sanitized : `55${sanitized}`;
        }
        return sanitized;
      }
      
      throw new Error('Nenhum número válido para envio');
    }

    const cleanNumber = sanitizePhoneNumberForQueue(body.phone_number, body.whatsapp_id);
    console.log('[send-whatsapp-message] Clean number:', cleanNumber);

    // 🆕 FASE 6: Se usar fila, enfileirar e retornar imediatamente
    if (useQueue) {
      console.log('[send-whatsapp-message] 📥 Enfileirando mensagem para rate limiting...');
      
      // Verificar rate limits antes de enfileirar
      const { data: rateLimitCheck } = await supabase
        .rpc('update_rate_limit_counters', { p_instance_id: body.instance_id });
      
      const canSend = rateLimitCheck?.[0]?.can_send ?? true;
      const waitMs = rateLimitCheck?.[0]?.wait_ms ?? 0;
      
      // Calcular scheduled_at baseado no rate limit
      const scheduledAt = canSend 
        ? new Date().toISOString()
        : new Date(Date.now() + waitMs).toISOString();
      
      // Inserir na fila
      const { data: queuedMessage, error: queueError } = await supabase
        .from('message_queue')
        .insert({
          instance_id: body.instance_id,
          conversation_id: body.conversation_id || null,
          phone_number: cleanNumber,
          message: body.message,
          message_type: 'text',
          priority: body.priority || 5, // 1 = urgente, 10 = baixa
          status: 'pending',
          scheduled_at: scheduledAt,
          metadata: {
            original_whatsapp_id: body.whatsapp_id,
            original_phone: body.phone_number,
            delay: body.delay || 1200
          }
        })
        .select('id, scheduled_at')
        .single();
      
      if (queueError) {
        console.error('[send-whatsapp-message] ❌ Erro ao enfileirar:', queueError);
        // Fallback: enviar diretamente se a fila falhar
        console.log('[send-whatsapp-message] ⚠️ Fallback para envio direto...');
      } else {
        console.log('[send-whatsapp-message] ✅ Mensagem enfileirada:', {
          id: queuedMessage.id,
          scheduled_at: queuedMessage.scheduled_at,
          rate_limited: !canSend
        });
        
        return new Response(
          JSON.stringify({
            success: true,
            queued: true,
            queue_id: queuedMessage.id,
            scheduled_at: queuedMessage.scheduled_at,
            rate_limited: !canSend,
            wait_ms: canSend ? 0 : waitMs
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 🔄 Verificar conexão real antes de enviar
    async function checkAndReconnect(): Promise<boolean> {
      // Verificar status atual na Evolution API
      const baseUrl = instance.api_url.replace(/\/manager$/, '').replace(/\/$/, '');
      
      try {
        const statusResponse = await fetch(`${baseUrl}/instance/connectionState/${instance.instance_name}`, {
          method: 'GET',
          headers: { 'apikey': instance.api_token },
        });
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log('[send-whatsapp-message] 🔍 Connection state:', statusData);
          
          const isConnected = statusData?.instance?.state === 'open' || 
                              statusData?.state === 'open' ||
                              statusData?.status === 'connected';
          
          if (isConnected) {
            // Atualizar status no banco se estava marcado como desconectado
            if (instance.status !== 'connected') {
              await supabase
                .from('whatsapp_instances')
                .update({ status: 'connected', consecutive_failures: 0 })
                .eq('id', instance.id);
            }
            return true;
          }
        }
        
        // Se não conectado, tentar reconectar
        console.log('[send-whatsapp-message] 🔄 Tentando reconectar instância...');
        
        const reconnectResponse = await fetch(`${baseUrl}/instance/connect/${instance.instance_name}`, {
          method: 'GET',
          headers: { 'apikey': instance.api_token },
        });
        
        if (reconnectResponse.ok) {
          // Aguardar 2s para conexão se estabelecer
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Verificar novamente
          const recheckResponse = await fetch(`${baseUrl}/instance/connectionState/${instance.instance_name}`, {
            method: 'GET',
            headers: { 'apikey': instance.api_token },
          });
          
          if (recheckResponse.ok) {
            const recheckData = await recheckResponse.json();
            const isNowConnected = recheckData?.instance?.state === 'open' || 
                                   recheckData?.state === 'open';
            
            if (isNowConnected) {
              await supabase
                .from('whatsapp_instances')
                .update({ status: 'connected', consecutive_failures: 0 })
                .eq('id', instance.id);
              console.log('[send-whatsapp-message] ✅ Reconexão bem-sucedida!');
              return true;
            }
          }
        }
        
        return false;
      } catch (error) {
        console.error('[send-whatsapp-message] ❌ Erro ao verificar/reconectar:', error);
        return false;
      }
    }

    // Verificar conexão real (não confiar apenas no status do banco)
    const isReallyConnected = await checkAndReconnect();
    
    if (!isReallyConnected) {
      console.error('[send-whatsapp-message] Instance not connected after reconnect attempt');
      
      // Atualizar status para desconectado no banco
      await supabase
        .from('whatsapp_instances')
        .update({ status: 'disconnected' })
        .eq('id', instance.id);
      
      return new Response(
        JSON.stringify({ 
          error: 'Instance not connected - reconnection failed', 
          status: 'disconnected',
          hint: 'Por favor, reconecte manualmente escaneando o QR code'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🔧 FASE 4: Sanitização com Suporte para LID
    function sanitizePhoneNumber(phone?: string, whatsappId?: string): string {
      console.log('[send-whatsapp-message] Sanitizing:', { phone, whatsappId });
      
      // 1. Se whatsapp_id for @s.whatsapp.net ou @c.us (número normal), extrair dígitos
      if (whatsappId && !whatsappId.endsWith('@lid')) {
        const digitsOnly = whatsappId.replace(/\D/g, '');
        
        // Normalizar brasileiro
        if (digitsOnly.length === 10 || digitsOnly.length === 11) {
          const normalized = digitsOnly.startsWith('55') ? digitsOnly : `55${digitsOnly}`;
          console.log('[send-whatsapp-message] ✅ Normalized from whatsapp_id:', normalized);
          return normalized;
        }
        
        console.log('[send-whatsapp-message] ✅ Using whatsapp_id digits:', digitsOnly);
        return digitsOnly;
      }
      
      // 2. Se for LID (@lid), usar phone_number como fallback (que agora tem o número real)
      if (whatsappId && whatsappId.endsWith('@lid')) {
        console.log('[send-whatsapp-message] 🔗 LID detected - using phone as fallback');
        
        if (!phone) {
          throw new Error('LID requer phone_number como fallback');
        }
        
        const sanitized = phone.replace(/\D/g, '');
        
        // Normalizar brasileiro
        if (sanitized.length === 10 || sanitized.length === 11) {
          const normalized = sanitized.startsWith('55') ? sanitized : `55${sanitized}`;
          console.log('[send-whatsapp-message] ✅ LID fallback normalized:', normalized);
          return normalized;
        }
        
        console.log('[send-whatsapp-message] ✅ LID fallback:', sanitized);
        return sanitized;
      }
      
      // 3. FALLBACK FINAL: phone_number apenas
      if (phone) {
        const sanitized = phone.replace(/\D/g, '');
        
        if (sanitized.length === 10 || sanitized.length === 11) {
          const normalized = sanitized.startsWith('55') ? sanitized : `55${sanitized}`;
          console.log('[send-whatsapp-message] ✅ Normalized from phone:', normalized);
          return normalized;
        }
        
        console.log('[send-whatsapp-message] ✅ Using phone:', sanitized);
        return sanitized;
      }
      
      throw new Error('Nenhum número válido para envio');
    }

    // Reusar cleanNumber já definido acima para envio direto (fallback ou use_queue=false)
    console.log('[send-whatsapp-message] Clean number for Evolution API (direct send):', cleanNumber);

    // 🚀 ENVIO: Evolution API v2.2.2 - Formato Exato
    const evolutionUrl = `${instance.api_url}/message/sendText/${instance.instance_name}`;
    console.log('[send-whatsapp-message] 📡 Sending to Evolution API v2.2.2:', evolutionUrl);

    const evolutionPayload = {
      number: cleanNumber, // ✅ APENAS DÍGITOS: "5511999998888"
      text: body.message,
      delay: body.delay || 1200,
      linkPreview: false
    };
    
    console.log('[send-whatsapp-message] 📦 Payload v2.2.2:', JSON.stringify(evolutionPayload, null, 2));

    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'apikey': instance.api_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(evolutionPayload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('[send-whatsapp-message] Evolution API error:', responseData);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send message via Evolution API',
          details: responseData 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-whatsapp-message] Message sent successfully:', responseData);

    return new Response(
      JSON.stringify({
        success: true,
        evolution_response: responseData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-whatsapp-message] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
