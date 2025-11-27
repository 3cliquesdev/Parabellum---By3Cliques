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

    // 🔧 FASE 2: Normalização Robusta com Prioridade de JID
    function normalizeWhatsAppNumber(phone?: string, whatsappId?: string): string {
      // 1. PRIORIDADE: Usar whatsapp_id (JID original) se disponível
      if (whatsappId) {
        // Garantir que tem sufixo JID
        if (!whatsappId.includes('@')) {
          return `${whatsappId}@s.whatsapp.net`;
        }
        return whatsappId; // Já tem sufixo correto (@lid, @s.whatsapp.net, etc.)
      }
      
      // 2. FALLBACK: Normalizar phone number
      if (!phone) {
        throw new Error('Nem whatsapp_id nem phone_number fornecidos');
      }
      
      // Sanitizar (remover não-dígitos)
      let normalized = phone.replace(/\D/g, '');
      
      // 3. Regra do Brasil - adicionar DDI 55 se for número BR sem prefixo
      if (normalized.length === 10 || normalized.length === 11) {
        if (!normalized.startsWith('55')) {
          normalized = `55${normalized}`;
        }
      }
      
      // 4. Adicionar sufixo padrão
      return `${normalized}@s.whatsapp.net`;
    }

    const normalizedPhone = normalizeWhatsAppNumber(body.phone_number, body.whatsapp_id);
    console.log('[send-whatsapp-message] Normalized number:', normalizedPhone);

    // Delay humanizado (1.2 segundos por padrão)
    const delay = body.delay ?? 1200;
    console.log(`[send-whatsapp-message] Waiting ${delay}ms to simulate typing...`);
    await new Promise(resolve => setTimeout(resolve, delay));

    // Enviar para Evolution API
    const evolutionUrl = `${instance.api_url}/message/sendText/${instance.instance_name}`;
    console.log('[send-whatsapp-message] Sending to Evolution API:', evolutionUrl);

    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'apikey': instance.api_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: normalizedPhone,
        text: body.message,
        delay: 1200,           // ✅ Evolution API v2 - tempo de digitação
        linkPreview: true,     // ✅ Habilitar preview de links
      }),
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
