import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportOptions {
  days_back?: number;
  user_id?: string;
  update_existing?: boolean;
}

const MAX_WINDOW_DAYS = 90;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let jobId: string | null = null;

  try {
    console.log('[import-kiwify-contacts] 🚀 Iniciando criação de fila de importação...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse options from request body
    const body = await req.json().catch(() => ({}));
    const options: ImportOptions = {
      days_back: body.days_back ?? 365,
      user_id: body.user_id,
      update_existing: body.update_existing ?? false,
    };

    console.log('[import-kiwify-contacts] 📋 Opções:', options);

    // 1. Verificar se há credenciais configuradas
    const { data: configs } = await supabaseClient
      .from('system_configurations')
      .select('key, value')
      .in('key', ['kiwify_client_id', 'kiwify_client_secret', 'kiwify_account_id']);

    const clientId = configs?.find(c => c.key === 'kiwify_client_id')?.value;
    const clientSecret = configs?.find(c => c.key === 'kiwify_client_secret')?.value;
    const accountId = configs?.find(c => c.key === 'kiwify_account_id')?.value;

    if (!clientId || !clientSecret || !accountId) {
      throw new Error('Credenciais Kiwify não configuradas');
    }

    // 2. Criar job de sincronização
    const { data: job, error: jobError } = await supabaseClient
      .from('sync_jobs')
      .insert({
        job_type: 'kiwify_contacts_import',
        status: 'running',
        started_at: new Date().toISOString(),
        created_by: options.user_id,
        options: options,
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error('Falha ao criar job de importação');
    }

    jobId = job.id;
    console.log('[import-kiwify-contacts] 📝 Job criado:', jobId);

    // 3. Calcular janelas de 90 dias
    const now = new Date();
    const daysBack = options.days_back ?? 365;
    const overallStart = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    
    const windows: Array<{ start: Date; end: Date }> = [];
    const dayMs = 24 * 60 * 60 * 1000;
    let windowEnd = now;

    while (windowEnd >= overallStart) {
      const windowStart = new Date(
        Math.max(overallStart.getTime(), windowEnd.getTime() - (MAX_WINDOW_DAYS - 1) * dayMs)
      );
      
      windows.push({ start: windowStart, end: windowEnd });
      
      // Move to previous period
      windowEnd = new Date(windowStart.getTime() - dayMs);
    }

    console.log(`[import-kiwify-contacts] 📅 ${windows.length} janelas de ${MAX_WINDOW_DAYS} dias criadas`);

    // 4. Criar items na fila para cada janela
    const queueItems = windows.map((window, index) => ({
      job_id: jobId,
      window_start: window.start.toISOString().split('T')[0],
      window_end: window.end.toISOString().split('T')[0],
      status: 'pending',
      scheduled_for: new Date(Date.now() + index * 5000).toISOString(), // Escalonar 5s entre cada
      retry_count: 0,
      max_retries: 3,
    }));

    const { error: queueError } = await supabaseClient
      .from('kiwify_import_queue')
      .insert(queueItems);

    if (queueError) {
      console.error('[import-kiwify-contacts] ❌ Erro ao criar fila:', queueError);
      throw new Error(`Falha ao criar fila de importação: ${queueError.message}`);
    }

    // 5. Atualizar job com total de windows
    await supabaseClient
      .from('sync_jobs')
      .update({ 
        total_items: windows.length,
        options: { ...options, total_windows: windows.length }
      })
      .eq('id', jobId);

    console.log('[import-kiwify-contacts] ✅ Fila de importação criada com sucesso');
    console.log(`[import-kiwify-contacts] 📊 ${windows.length} janelas agendadas para processamento`);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        windows_created: windows.length,
        message: `Importação agendada: ${windows.length} janelas de ${MAX_WINDOW_DAYS} dias serão processadas pelo CRON`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[import-kiwify-contacts] ❌ ERROR:', error);
    
    // Atualizar o job para failed
    if (jobId) {
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabaseClient
          .from('sync_jobs')
          .update({ 
            status: 'failed', 
            completed_at: new Date().toISOString(),
            errors: [{ message: error.message }]
          })
          .eq('id', jobId);
      } catch (updateErr) {
        console.error('[import-kiwify-contacts] Failed to update job status:', updateErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        job_id: jobId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
