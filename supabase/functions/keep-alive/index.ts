import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Keep-Alive Edge Function
 * 
 * Mantém as Edge Functions críticas "quentes" para evitar cold starts.
 * Executada a cada 5 minutos via CRON.
 * 
 * Funções aquecidas:
 * - meta-whatsapp-webhook (recebimento de mensagens)
 * - ai-autopilot-chat (processamento IA)
 * - send-meta-whatsapp (envio de mensagens)
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[keep-alive] 🔥 Starting warmup cycle...');

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    console.error('[keep-alive] ❌ Missing environment variables');
    return new Response(
      JSON.stringify({ error: 'Missing environment variables' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const results: Record<string, { status: string; time: number }> = {};

  // Aquecer funções críticas em paralelo
  const warmupTasks = [
    // 1. meta-whatsapp-webhook (GET = verificação do webhook)
    {
      name: 'meta-whatsapp-webhook',
      fn: async () => {
        const start = Date.now();
        try {
          const response = await fetch(
            `${supabaseUrl}/functions/v1/meta-whatsapp-webhook?hub.mode=warmup&hub.verify_token=warmup`,
            { method: 'GET' }
          );
          return { status: response.ok ? 'warm' : 'error', time: Date.now() - start };
        } catch (error) {
          return { status: 'error', time: Date.now() - start };
        }
      }
    },
    // 2. ai-autopilot-chat (POST com flag warmup)
    {
      name: 'ai-autopilot-chat',
      fn: async () => {
        const start = Date.now();
        try {
          const response = await fetch(
            `${supabaseUrl}/functions/v1/ai-autopilot-chat`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ warmup: true })
            }
          );
          return { status: response.ok ? 'warm' : 'error', time: Date.now() - start };
        } catch (error) {
          return { status: 'error', time: Date.now() - start };
        }
      }
    },
    // 3. send-meta-whatsapp (POST com flag warmup)
    {
      name: 'send-meta-whatsapp',
      fn: async () => {
        const start = Date.now();
        try {
          const response = await fetch(
            `${supabaseUrl}/functions/v1/send-meta-whatsapp`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ warmup: true })
            }
          );
          return { status: response.ok ? 'warm' : 'error', time: Date.now() - start };
        } catch (error) {
          return { status: 'error', time: Date.now() - start };
        }
      }
    },
    // 4. diagnose-meta-whatsapp (útil para verificações)
    {
      name: 'diagnose-meta-whatsapp',
      fn: async () => {
        const start = Date.now();
        try {
          const response = await fetch(
            `${supabaseUrl}/functions/v1/diagnose-meta-whatsapp`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ warmup: true })
            }
          );
          return { status: response.ok ? 'warm' : 'error', time: Date.now() - start };
        } catch (error) {
          return { status: 'error', time: Date.now() - start };
        }
      }
    }
  ];

  // Executar todas as chamadas em paralelo
  const warmupResults = await Promise.allSettled(
    warmupTasks.map(async (task) => {
      const result = await task.fn();
      results[task.name] = result;
      return result;
    })
  );

  const totalTime = Date.now() - startTime;
  const successCount = Object.values(results).filter(r => r.status === 'warm').length;

  console.log(`[keep-alive] ✅ Warmup complete: ${successCount}/${warmupTasks.length} functions warmed in ${totalTime}ms`);
  console.log('[keep-alive] Results:', JSON.stringify(results, null, 2));

  return new Response(
    JSON.stringify({
      success: true,
      warmed: successCount,
      total: warmupTasks.length,
      totalTime,
      results
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
});
