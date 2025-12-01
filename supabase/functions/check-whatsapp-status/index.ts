import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[check-whatsapp-status] 🔍 Iniciando verificação de status WhatsApp...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Buscar todas as instâncias WhatsApp
    const { data: instances, error: instancesError } = await supabase
      .from('whatsapp_instances')
      .select('*');

    if (instancesError) {
      console.error('[check-whatsapp-status] ❌ Erro ao buscar instâncias:', instancesError);
      throw instancesError;
    }

    console.log(`[check-whatsapp-status] Encontradas ${instances?.length || 0} instâncias`);

    const disconnectedInstances = instances?.filter(i => i.status === 'disconnected') || [];

    if (disconnectedInstances.length === 0) {
      console.log('[check-whatsapp-status] ✅ Todas as instâncias conectadas');
      return new Response(
        JSON.stringify({ success: true, all_connected: true, total: instances?.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🚨 ALERTA: Instâncias desconectadas encontradas
    console.log(`[check-whatsapp-status] 🚨 ${disconnectedInstances.length} instância(s) desconectada(s):`);
    disconnectedInstances.forEach(i => {
      console.log(`  - ${i.name} (${i.instance_name})`);
    });

    // Enviar alerta para admins
    const instanceNames = disconnectedInstances.map(i => i.name).join(', ');
    const alertMessage = `🚨 ${disconnectedInstances.length} instância(s) WhatsApp desconectada(s): ${instanceNames}`;

    const { error: alertError } = await supabase.functions.invoke('send-admin-alert', {
      body: {
        type: 'whatsapp_disconnected',
        message: alertMessage,
        error: `Instâncias afetadas: ${disconnectedInstances.map(i => i.instance_name).join(', ')}`,
      },
    });

    if (alertError) {
      console.error('[check-whatsapp-status] ❌ Erro ao enviar alerta:', alertError);
    } else {
      console.log('[check-whatsapp-status] ✅ Alerta enviado para admins');
    }

    return new Response(
      JSON.stringify({
        success: true,
        disconnected_count: disconnectedInstances.length,
        disconnected_instances: disconnectedInstances.map(i => ({
          name: i.name,
          instance_name: i.instance_name,
          status: i.status,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-whatsapp-status] ❌ Erro crítico:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
