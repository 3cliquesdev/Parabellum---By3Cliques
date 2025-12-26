import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrackingResult {
  box_number: string;
  platform: string | null;
  status: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tracking_code, tracking_codes } = await req.json();
    
    // Support single or multiple tracking codes
    const codes: string[] = tracking_codes || (tracking_code ? [tracking_code] : []);
    
    if (codes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'tracking_code ou tracking_codes é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fetch-tracking] 🔍 Buscando rastreios:', codes);

    // Get MySQL credentials from secrets
    const mysqlHost = Deno.env.get('MYSQL_HOST');
    const mysqlPort = parseInt(Deno.env.get('MYSQL_PORT') || '3306');
    const mysqlUser = Deno.env.get('MYSQL_USER');
    const mysqlPassword = Deno.env.get('MYSQL_PASSWORD');
    const mysqlDatabase = Deno.env.get('MYSQL_DATABASE');

    if (!mysqlHost || !mysqlUser || !mysqlPassword || !mysqlDatabase) {
      console.error('[fetch-tracking] ❌ Credenciais MySQL não configuradas');
      return new Response(
        JSON.stringify({ error: 'Credenciais do banco de rastreio não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Connect to external MySQL
    const client = await new Client().connect({
      hostname: mysqlHost,
      port: mysqlPort,
      username: mysqlUser,
      password: mysqlPassword,
      db: mysqlDatabase,
    });

    console.log('[fetch-tracking] ✅ Conectado ao MySQL externo');

    // Build query with parameterized placeholders
    const placeholders = codes.map(() => '?').join(', ');
    const query = `
      SELECT box_number, platform, status, created_at, updated_at 
      FROM parcel 
      WHERE box_number IN (${placeholders})
    `;

    const results = await client.query(query, codes);
    
    console.log('[fetch-tracking] 📦 Resultados encontrados:', results?.length || 0);

    // Close connection
    await client.close();

    // Map results for easier consumption
    const trackingData: Record<string, TrackingResult | null> = {};
    
    // Initialize all requested codes as null
    for (const code of codes) {
      trackingData[code] = null;
    }
    
    // Fill in found results
    if (results && Array.isArray(results)) {
      for (const row of results) {
        const boxNumber = row.box_number as string;
        trackingData[boxNumber] = {
          box_number: boxNumber,
          platform: row.platform as string | null,
          status: row.status as string | null,
          created_at: row.created_at as Date | null,
          updated_at: row.updated_at as Date | null,
        };
      }
    }

    // Format response
    const response = {
      success: true,
      found: Object.values(trackingData).filter(v => v !== null).length,
      total_requested: codes.length,
      data: trackingData,
    };

    console.log('[fetch-tracking] ✅ Retornando dados:', response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fetch-tracking] ❌ Erro:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Erro ao consultar rastreio',
        details: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
