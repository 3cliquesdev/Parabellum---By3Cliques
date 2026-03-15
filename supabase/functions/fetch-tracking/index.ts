import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrackingResult {
  original_code: string;
  platform_order_id: string | null;
  tracking_number: string | null;
  platform: string | null;
  status: string | null;
  order_status: string | null;
  express_time: Date | null;
  express_time_formatted: string | null;
  is_packed: boolean;
  packing_message: string;
  buyer_name: string | null;
}

// Detectar tipo de código automaticamente
function detectSearchType(code: string): 'tracking' | 'order_id' {
  const upperCode = code.toUpperCase().trim();
  // Códigos de rastreio geralmente começam com BR, LP, LB, ou similares
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

// Mapear order_status para texto legível
function mapOrderStatus(status: string | null): string {
  const statusMap: Record<string, string> = {
    '1': 'Aguardando Envio',
    '2': 'Em Preparação',
    '3': 'Enviado',
    '4': 'Entregue',
    '5': 'Cancelado',
    '6': 'Devolvido',
  };
  return status ? (statusMap[status] || `Status ${status}`) : 'Desconhecido';
}

// Determinar status de embalagem baseado em express_time
function getPackingStatus(expressTime: Date | null, orderStatus: string | null): { is_packed: boolean; packing_message: string } {
  // Se não tem express_time, o pedido ainda não foi embalado
  if (!expressTime) {
    return {
      is_packed: false,
      packing_message: 'Seu pedido ainda está sendo preparado. Se foi pago recentemente, aguarde alguns dias úteis para o envio.'
    };
  }
  
  // Se tem express_time, foi embalado/enviado
  return {
    is_packed: true,
    packing_message: 'Pedido embalado e enviado.'
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tracking_code, tracking_codes, debug_schema, debug_tables, debug_table } = await req.json();
    
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

    // Debug mode: listar todas as tabelas
    if (debug_tables) {
      const tablesResult = await client.query('SHOW TABLES');
      await client.close();
      
      return new Response(
        JSON.stringify({ 
          success: true,
          tables: tablesResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Debug mode: analisar uma tabela específica
    if (debug_table) {
      const schemaResult = await client.query(`DESCRIBE ${debug_table}`);
      const sampleResult = await client.query(`SELECT * FROM ${debug_table} LIMIT 2`);
      await client.close();
      
      return new Response(
        JSON.stringify({ 
          success: true,
          table: debug_table,
          schema: schemaResult,
          sample: sampleResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Debug mode: retornar estrutura da tabela parcel
    if (debug_schema) {
      const schemaResult = await client.query('DESCRIBE parcel');
      const sampleResult = await client.query('SELECT * FROM parcel LIMIT 3');
      await client.close();
      
      return new Response(
        JSON.stringify({ 
          success: true,
          parcel_schema: schemaResult,
          parcel_sample: sampleResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Support single or multiple tracking codes
    const codes: string[] = tracking_codes || (tracking_code ? [tracking_code] : []);
    
    if (codes.length === 0) {
      await client.close();
      return new Response(
        JSON.stringify({ error: 'tracking_code ou tracking_codes é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fetch-tracking] 🔍 Buscando rastreios:', codes);

    // Separar códigos por tipo
    const trackingCodes = codes.filter(c => detectSearchType(c) === 'tracking');
    const orderIds = codes.filter(c => detectSearchType(c) === 'order_id');
    
    console.log('[fetch-tracking] 📊 Tipos detectados:', {
      trackingCodes: trackingCodes.length,
      orderIds: orderIds.length,
      tracking: trackingCodes,
      orders: orderIds
    });

    let allResults: any[] = [];

    // ========== BUSCAR POR CÓDIGO DE RASTREIO (BR..., LP..., LB...) ==========
    // Primeiro tenta na tabela parcel (tracking_number)
    if (trackingCodes.length > 0) {
      const placeholders = trackingCodes.map(() => '?').join(', ');
      const query = `
        SELECT 
          box_number as platform_order_id, 
          tracking_number, 
          platform, 
          status as order_status, 
          updated_at as express_time,
          NULL as buyer_name
        FROM parcel 
        WHERE tracking_number IN (${placeholders})
      `;
      console.log('[fetch-tracking] 🔍 Query parcel.tracking_number:', query, trackingCodes);
      
      const results = await client.query(query, trackingCodes);
      console.log('[fetch-tracking] 📦 Resultados parcel:', results?.length || 0);
      
      if (results && Array.isArray(results)) {
        allResults = allResults.concat(results.map((r: any) => ({ ...r, source: 'parcel' })));
      }
      
      // Também tenta em mabang_order.track_number
      try {
        const query2 = `
          SELECT 
            platform_order_id, 
            track_number as tracking_number, 
            platform_id as platform, 
            order_status, 
            express_time,
            buyer_name
          FROM mabang_order 
          WHERE track_number IN (${placeholders})
        `;
        console.log('[fetch-tracking] 🔍 Query mabang_order.track_number:', query2, trackingCodes);
        
        const results2 = await client.query(query2, trackingCodes);
        console.log('[fetch-tracking] 📦 Resultados mabang_order track:', results2?.length || 0);
        
        if (results2 && Array.isArray(results2)) {
          allResults = allResults.concat(results2.map((r: any) => ({ ...r, source: 'mabang_order' })));
        }
      } catch (e) {
        console.log('[fetch-tracking] ℹ️ Erro query mabang_order track:', e);
      }
    }

    // ========== BUSCAR POR NÚMERO DO PEDIDO ==========
    // Busca em mabang_order.platform_order_id com LIKE '%-{numero}'
    if (orderIds.length > 0) {
      try {
        const likeConditions = orderIds.map(() => 'platform_order_id LIKE ?').join(' OR ');
        const likeParams = orderIds.map(id => `%-${id}`);
        
        const query = `
          SELECT 
            platform_order_id, 
            track_number as tracking_number, 
            platform_id as platform, 
            order_status, 
            express_time,
            buyer_name
          FROM mabang_order 
          WHERE ${likeConditions}
        `;
        
        console.log('[fetch-tracking] 🔍 Query mabang_order.platform_order_id:', query, likeParams);
        
        const results = await client.query(query, likeParams);
        console.log('[fetch-tracking] 📦 Resultados mabang_order:', results?.length || 0);
        
        if (results && Array.isArray(results)) {
          allResults = allResults.concat(results.map((r: any) => ({ ...r, source: 'mabang_order' })));
        }
      } catch (e) {
        console.log('[fetch-tracking] ℹ️ Erro query mabang_order:', e);
      }
      
      // Também tenta em parcel.box_number
      try {
        const exactConditions = orderIds.map(() => 'box_number = ?').join(' OR ');
        const likeConditions = orderIds.map(() => 'box_number LIKE ?').join(' OR ');
        const allParams = [...orderIds, ...orderIds.map(id => `%-${id}`)];
        
        const query = `
          SELECT 
            box_number as platform_order_id, 
            tracking_number, 
            platform, 
            status as order_status, 
            updated_at as express_time,
            NULL as buyer_name
          FROM parcel 
          WHERE (${exactConditions}) OR (${likeConditions})
        `;
        
        console.log('[fetch-tracking] 🔍 Query parcel.box_number:', query, allParams);
        
        const results = await client.query(query, allParams);
        console.log('[fetch-tracking] 📦 Resultados parcel box:', results?.length || 0);
        
        if (results && Array.isArray(results)) {
          allResults = allResults.concat(results.map((r: any) => ({ ...r, source: 'parcel' })));
        }
      } catch (e) {
        console.log('[fetch-tracking] ℹ️ Erro query parcel box:', e);
      }
    }

    console.log('[fetch-tracking] 📦 Total resultados encontrados:', allResults.length);

    // Close connection
    await client.close();

    // Map results for easier consumption
    const trackingData: Record<string, TrackingResult | null> = {};
    
    // Initialize all requested codes as null
    for (const code of codes) {
      trackingData[code] = null;
    }
    
    // Fill in found results with enhanced data
    for (const row of allResults) {
      const trackingNum = row.tracking_number as string | null;
      const platformOrderId = row.platform_order_id as string | null;
      const platform = row.platform as string | null;
      const expressTime = row.express_time as Date | null;
      const orderStatus = row.order_status as string | null;
      const buyerName = row.buyer_name as string | null;
      
      // Identificar qual código original encontrou este resultado
      const originalCode = codes.find(c => {
        const upperC = c.toUpperCase();
        // Match por tracking_number (case insensitive)
        if (trackingNum && upperC === trackingNum.toUpperCase()) return true;
        // Match exato por platform_order_id
        if (platformOrderId && upperC === platformOrderId.toUpperCase()) return true;
        // Match por final do platform_order_id (sufixo)
        if (platformOrderId && platformOrderId.toUpperCase().endsWith(`-${upperC}`)) return true;
        return false;
      });
      
      if (originalCode && !trackingData[originalCode]) {
        // Determinar status de embalagem baseado em express_time
        const packingStatus = getPackingStatus(expressTime, orderStatus);
        
        trackingData[originalCode] = {
          original_code: originalCode,
          platform_order_id: platformOrderId,
          tracking_number: trackingNum,
          platform: platform,
          status: mapOrderStatus(orderStatus),
          order_status: orderStatus,
          express_time: expressTime,
          express_time_formatted: formatDate(expressTime),
          is_packed: packingStatus.is_packed,
          packing_message: packingStatus.packing_message,
          buyer_name: buyerName,
        };
        
        console.log('[fetch-tracking] ✅ Mapeado:', originalCode, '→', {
          platform_order_id: platformOrderId,
          tracking_number: trackingNum,
          status: mapOrderStatus(orderStatus),
          express_time: formatDate(expressTime)
        });
      }
    }

    // Format response
    const response = {
      success: true,
      found: Object.values(trackingData).filter(v => v !== null).length,
      total_requested: codes.length,
      data: trackingData,
    };

    console.log('[fetch-tracking] ✅ Retornando:', {
      found: response.found,
      total_requested: response.total_requested
    });

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
