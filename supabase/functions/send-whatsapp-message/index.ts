import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    if (instance.status !== 'connected') {
      console.error('[send-whatsapp-message] Instance not connected:', instance.status);
      return new Response(
        JSON.stringify({ error: 'Instance not connected', status: instance.status }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🔧 SANITIZAÇÃO ROBUSTA: Limpar número para envio
    function sanitizePhoneNumber(phone?: string, whatsappId?: string): string {
      // 1. PRIORIDADE: Usar whatsapp_id se disponível (já validado pela Evolution)
      if (whatsappId) {
        // Se já tem sufixo JID, usar direto
        if (whatsappId.includes('@')) {
          return whatsappId;
        }
        // Caso contrário, adicionar sufixo padrão
        return `${whatsappId}@s.whatsapp.net`;
      }
      
      // 2. FALLBACK: Normalizar phone_number
      if (!phone) {
        throw new Error('Nem whatsapp_id nem phone_number fornecidos');
      }
      
      // Remover TODOS os caracteres não numéricos
      let sanitized = phone.replace(/\D/g, '');
      
      // 3. Regra do Brasil - adicionar DDI 55 se necessário
      if (sanitized.length === 10 || sanitized.length === 11) {
        if (!sanitized.startsWith('55')) {
          sanitized = `55${sanitized}`;
        }
      }
      
      console.log('[send-whatsapp-message] Sanitized phone:', sanitized);
      return sanitized; // ✅ Retornar APENAS NÚMEROS (sem sufixo)
    }

    const cleanNumber = sanitizePhoneNumber(body.phone_number, body.whatsapp_id);
    console.log('[send-whatsapp-message] Clean number for Evolution API:', cleanNumber);

    // Enviar para Evolution API v2 (Formato Texto Simples - Mais Compatível)
    const evolutionUrl = `${instance.api_url}/message/sendText/${instance.instance_name}`;
    console.log('[send-whatsapp-message] Sending to Evolution API:', evolutionUrl);

    const evolutionPayload = {
      number: cleanNumber, // ✅ String pura: "5511999999999"
      text: body.message,
      delay: body.delay || 1000,
      linkPreview: false
    };
    
    console.log('[send-whatsapp-message] Payload:', JSON.stringify(evolutionPayload, null, 2));

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
