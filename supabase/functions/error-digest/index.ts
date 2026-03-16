import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString().split('T')[0];

    // Fetch errors from last 24h
    const { data: errors, error } = await supabase
      .from('client_error_logs')
      .select('error_type, message, metadata, created_at')
      .gte('created_at', since24h)
      .limit(1000);

    if (error) throw error;

    const allErrors = errors || [];
    const totalErrors = allErrors.length;

    // Errors by type
    const errorsByType: Record<string, number> = {};
    allErrors.forEach((e: { error_type: string }) => {
      errorsByType[e.error_type] = (errorsByType[e.error_type] || 0) + 1;
    });

    // Top errors
    const msgCounts: Record<string, { count: number; type: string }> = {};
    allErrors.forEach((e: { message: string; error_type: string }) => {
      const key = e.message.slice(0, 150);
      if (!msgCounts[key]) msgCounts[key] = { count: 0, type: e.error_type };
      msgCounts[key].count++;
    });
    const topErrors = Object.entries(msgCounts)
      .map(([message, { count, type }]) => ({ message, count, type }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Edge function failures
    const efErrors = allErrors.filter((e: { error_type: string }) => e.error_type === 'edge_function');
    const efCounts: Record<string, number> = {};
    efErrors.forEach((e: { metadata: Record<string, unknown> | null; message: string }) => {
      const url = (e.metadata as Record<string, unknown>)?.url as string || e.message;
      const shortUrl = url.replace(/.*\/functions\/v1\//, '');
      efCounts[shortUrl] = (efCounts[shortUrl] || 0) + 1;
    });
    const edgeFunctionFailures = Object.entries(efCounts)
      .map(([url, count]) => ({ url, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Upsert digest
    const { error: upsertError } = await supabase
      .from('error_digests')
      .upsert({
        digest_date: today,
        total_errors: totalErrors,
        errors_by_type: errorsByType,
        top_errors: topErrors,
        edge_function_failures: edgeFunctionFailures,
      }, { onConflict: 'digest_date' });

    if (upsertError) throw upsertError;

    // Cleanup old logs
    await supabase.rpc('cleanup_old_error_logs');

    return new Response(JSON.stringify({
      success: true,
      digest_date: today,
      total_errors: totalErrors,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[error-digest] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
