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
  packed_at: Date | null;
  packed_at_formatted: string | null;
  is_packed: boolean;
}

// Detectar tipo de código automaticamente
function detectSearchType(code: string): 'tracking' | 'order_id' {
  const upperCode = code.toUpperCase().trim();
  // Códigos de rastreio geralmente começam com BR, LP, ou similares
  if (upperCode.startsWith('BR') || upperCode.startsWith('LP') || upperCode.startsWith('LB')) {
    return 'tracking';
  }
  return 'order_id';
}

// Formatar data para exibição
function formatDate(date: Date | null): string | null {
  if (!date) return null;
  try {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  } catch {
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tracking_code, tracking_codes, search_type } = await req.json();
    
    // Support single or multiple tracking codes
    const codes: string[] = tracking_codes || (tracking_code ? [tracking_code] : []);
    
    if (codes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'tracking_code ou tracking_codes é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fetch-tracking] 🔍 Buscando rastreios:', codes, 'search_type:', search_type);

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
    
    // Fill in found results with enhanced data
    if (results && Array.isArray(results)) {
      for (const row of results) {
        const boxNumber = row.box_number as string;
        const createdAt = row.created_at as Date | null;
        
        trackingData[boxNumber] = {
          box_number: boxNumber,
          platform: row.platform as string | null,
          status: row.status as string | null,
          created_at: createdAt,
          updated_at: row.updated_at as Date | null,
          // Novos campos para horário de embalagem
          packed_at: createdAt, // created_at = horário de embalagem
          packed_at_formatted: formatDate(createdAt),
          is_packed: !!createdAt, // Se tem created_at, foi embalado
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
