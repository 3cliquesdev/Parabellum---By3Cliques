import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendWhatsAppRequest {
  instance_id: string;
  phone_number: string;
  message: string;
  delay?: number; // Delay em milissegundos (default: 3000-5000ms aleatório)
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
      delay: body.delay,
    });

    // Validação básica
    if (!body.instance_id || !body.phone_number || !body.message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
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

    // Delay humanizado (3-5 segundos por padrão)
    const delay = body.delay ?? (3000 + Math.random() * 2000);
    console.log(`[send-whatsapp-message] Waiting ${delay}ms to simulate typing...`);
    await new Promise(resolve => setTimeout(resolve, delay));

    // Normalizar número (remover caracteres especiais, adicionar @s.whatsapp.net se necessário)
    let normalizedPhone = body.phone_number.replace(/\D/g, '');
    if (!normalizedPhone.includes('@')) {
      normalizedPhone = `${normalizedPhone}@s.whatsapp.net`;
    }

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
